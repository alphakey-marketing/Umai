/**
 * audioExtract.ts
 *
 * Extracts audio from a video File using a hidden <video> element +
 * MediaRecorder (captureStream). This works for ANY container the browser
 * can play (mp4/h264, mkv/vp9, webm, etc.) — unlike AudioContext.decodeAudioData
 * which only handles pure-audio formats (mp3, wav, ogg).
 *
 * Returns a Float32Array of mono 16 kHz PCM — ready for the Whisper worker.
 *
 * @param videoFile   The video File to extract audio from
 * @param onProgress  Optional 0-100 progress callback
 */
export async function extractAudioFromVideo(
  videoFile: File,
  onProgress?: (pct: number) => void
): Promise<{ pcm: Float32Array; sampleRate: number }> {
  return new Promise((resolve, reject) => {
    // 1. Create a hidden video element and load the file
    const videoEl  = document.createElement('video');
    videoEl.muted  = false;            // must be unmuted for captureStream audio
    videoEl.volume = 0.0001;           // near-silent so user doesn't hear it
    videoEl.style.cssText = 'position:fixed;opacity:0;pointer-events:none;width:1px;height:1px;';
    document.body.appendChild(videoEl);

    const objectURL = URL.createObjectURL(videoFile);
    videoEl.src     = objectURL;

    videoEl.onerror = () => {
      cleanup();
      reject(new Error(`Browser cannot play this video format. Try converting to .webm or .mp4/H.264.`));
    };

    videoEl.onloadedmetadata = async () => {
      const duration = videoEl.duration; // seconds

      try {
        // 2. Capture the audio stream
        const stream   = (videoEl as HTMLVideoElement & { captureStream(): MediaStream }).captureStream();
        const audioCtx = new AudioContext({ sampleRate: 16000 });
        const dest     = audioCtx.createMediaStreamDestination();
        const source   = audioCtx.createMediaStreamSource(stream);
        source.connect(dest);

        // 3. Record the destination stream as webm/opus
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';
        const recorder = new MediaRecorder(dest.stream, { mimeType });
        const chunks: Blob[] = [];
        recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

        recorder.onstop = async () => {
          try {
            // 4. Decode the recorded webm/opus blob with AudioContext
            const blob        = new Blob(chunks, { type: mimeType });
            const arrayBuffer = await blob.arrayBuffer();
            const decodeCtx   = new AudioContext({ sampleRate: 16000 });
            const audioBuf    = await decodeCtx.decodeAudioData(arrayBuffer);
            decodeCtx.close();

            // 5. Merge to mono Float32Array
            const numCh  = audioBuf.numberOfChannels;
            const len    = audioBuf.length;
            const mono   = new Float32Array(len);
            for (let ch = 0; ch < numCh; ch++) {
              const ch_data = audioBuf.getChannelData(ch);
              for (let i = 0; i < len; i++) mono[i] += ch_data[i] / numCh;
            }

            cleanup();
            resolve({ pcm: mono, sampleRate: 16000 });
          } catch (e) {
            cleanup();
            reject(e);
          }
        };

        // 6. Play + record at 4x speed to finish faster
        videoEl.playbackRate = 4.0;
        videoEl.ontimeupdate = () => {
          const pct = (videoEl.currentTime / duration) * 100;
          onProgress?.(Math.min(Math.round(pct), 99));
        };
        videoEl.onended = () => {
          recorder.stop();
          audioCtx.close();
          onProgress?.(100);
        };

        recorder.start(250); // collect in 250ms chunks
        await videoEl.play();
      } catch (e) {
        cleanup();
        reject(e);
      }
    };

    function cleanup() {
      videoEl.pause();
      URL.revokeObjectURL(objectURL);
      document.body.removeChild(videoEl);
    }
  });
}
