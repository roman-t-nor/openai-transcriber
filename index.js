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

  // Check file size (limit to 25MB for Whisper API)
  const maxSize = 25 * 1024 * 1024; // 25MB
  if (file.size > maxSize) {
    fs.unlinkSync(file.path); // Clean up
    return res.status(400).send({ 
      error: "File too large. Maximum size is 25MB."  
    });
  }

  // Set a longer timeout for this specific request 
  req.setTimeout(300000); // 5 minutes
  res.setTimeout(300000); // 5 minutes

  try {
    console.log(`Begin transcribing file: ${file.originalname} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
    
    // Process audio file
    const extension = path.extname(file.originalname) || ".mp3";
    const renamedPath = `${file.path}${extension}`;
    fs.renameSync(file.path, renamedPath);

    const whisperRequest = {
      file: fs.createReadStream(renamedPath),
      model: "whisper-1",
      language: "no",
      response_format: format,
      temperature: 0.0,
      prompt: 'Please transcribe this Norwegian audio'
    };

    console.log("Sending request to OpenAI Whisper API...");
    const startTime = Date.now();
    
    let transcription = await openai.audio.transcriptions.create(whisperRequest);
    
    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`Transcription completed in ${processingTime} seconds`);

    // Format the response based on the requested format
    if (format === "srt") {
      transcription = "WEBVTT - Tekstebanken\n\n" + transcription;
    }

    // Clean up
    fs.unlinkSync(renamedPath);

    res.send({ 
      transcript: transcription,
      processingTime: processingTime,
      fileSize: file.size
    });
  } catch (err) {
    console.error("Transcription failed:", err);
    
    // Clean up file on error
    try {
      if (file && file.path) {
        fs.unlinkSync(file.path);
      }
    } catch (cleanupErr) {
      console.error("Error cleaning up file:", cleanupErr);
    }

    // Handle specific OpenAI errors
    if (err.code === 'timeout') {
      res.status(408).send({
        error: "Request timeout",
        message: "The transcription took too long to complete. Please try with a shorter audio file."
      });
    } else if (err.status === 413) {
      res.status(413).send({
        error: "File too large",
        message: "The audio file is too large for processing."
      });
    } else {
      console.error("Transcription failed:", err);
      res.status(500).send({
        error: "Transcription failed",
        message: err?.message || "Unknown error"
      });
    }
  }
});

app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
