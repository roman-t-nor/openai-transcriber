function transcriberApp() {
    return {
        file: null,
        format: 'srt',
        transcript: '',
        uploading: false,

        handleFileChange(e) {
            this.file = e.target.files[0];
        },

        async uploadFile() {
            if (!this.file) return alert("Please select a file.");
            this.uploading = true;
            const formData = new FormData();
            formData.append("audio", this.file);
            formData.append("format", this.format);

            try {
                const res = await fetch("/transcribe?format=" + this.format, {
                    method: "POST",
                    body: formData
                });
                const data = await res.json();
                this.transcript = data.transcript || "No transcription returned.";
            } catch (err) {
                alert("Transcription failed.");
                console.error(err);
            } finally {
                this.uploading = false;
            }
        },

        saveResult() {
            const blob = new Blob([this.transcript], { type: "text/plain;charset=utf-8" });
            const a = document.createElement("a");

            const fileName = this.file.name.substring(0, this.file.name.lastIndexOf("."))
            const fileExt = this.format === 'srt' ? 'srt' : 'txt'
            a.href = URL.createObjectURL(blob);
            a.download = `${fileName}.${fileExt}`;
            a.click();
        }
    }
}