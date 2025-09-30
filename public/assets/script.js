function transcriberApp() {
    return {
        file: null,
        format: 'srt',
        transcript: '',
        uploading: false,
        processingMessage: '',

        handleFileChange(e) {
            this.file = e.target.files[0];
        },

        async uploadFile() {
            if (!this.file) return alert("Please select a file.");
            
            // Check file size (25MB limit)
            const maxSize = 25 * 1024 * 1024; // 25MB
            if (this.file.size > maxSize) {
                alert("File too large. Maximum size is 25MB.");
                return;
            }
            
            this.uploading = true;
            this.processingMessage = "Processing... This may take a few minutes for longer audio files.";
            this.transcript = ''; // Clear any previous transcript
            
            const formData = new FormData();
            formData.append("audio", this.file);

            try {
                const res = await fetch("/transcribe?format=" + this.format, {
                    method: "POST",
                    body: formData,
                    // Increase timeout for the fetch request
                    signal: AbortSignal.timeout(300000) // 5 minutes
                });
                
                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(errorData.message || `HTTP ${res.status}: ${errorData.error}`);
                }
                
                const data = await res.json();
                this.transcript = data.transcript || "No transcription returned.";
                
                // Show processing time if available
                if (data.processingTime) {
                    console.log(`Transcription completed in ${data.processingTime} seconds`);
                }
            } catch (err) {
                if (err.name === 'TimeoutError') {
                    this.transcript = "Transcription timed out. Please try with a shorter audio file.";
                } else if (err.message.includes('File too large')) {
                    this.transcript = "File too large. Please select a file smaller than 25MB.";
                } else {
                    this.transcript = `Transcription failed: ${err.message}`;
                }
                console.error(err);
            } finally {
                this.uploading = false;
                this.processingMessage = '';
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