import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { config } from "dotenv";
import OpenAI from "openai";

config(); // Load .env

const app = express();
const port = 3000;

// Serve static frontend
app.use(express.static("public"));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Ensure uploads directory exists
const uploadDir = path.join("uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const upload = multer({
  dest: uploadDir,
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/octet-stream", "audio/mpeg", "audio/mp3",
      "audio/wav", "audio/x-wav", "audio/webm", "audio/ogg",
      "audio/mp4", "audio/flac"
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type"));
    }
  },
});

app.post("/transcribe", upload.single("audio"), async (req, res) => {
  const file = req.file;
  const format = req.query.format || "text"; // "text" or "srt"

  if (!file) {
    return res.status(400).send({ error: "No file uploaded." });
  }

  try {
    const extension = path.extname(file.originalname) || ".mp3";
    const renamedPath = `${file.path}${extension}`;
    fs.renameSync(file.path, renamedPath);

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(renamedPath),
      model: "whisper-1",
      response_format: format, // "text" or "srt"
      language: "no", // Optional: set your language code
    });

    // Clean up
    fs.unlinkSync(renamedPath);

    res.send({ transcript: transcription });
  } catch (err) {
    console.error("Transcription failed:", err);
    res.status(500).send({
      error: "Transcription failed",
      message: err?.message || "Unknown error"
    });
  }
});

app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
