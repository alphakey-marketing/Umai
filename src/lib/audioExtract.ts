/**
 * audioExtract.ts
 *
 * Extracts mono 16 kHz PCM from any video File the browser can play.
 *
 * Method: hidden muted <video> → createMediaElementSource → ScriptProcessorNode
 * → collect Float32Array chunks → resample to 16 kHz.
 *
 * Why this works in Replit sandboxed iframes:
 *   ✅ No captureStream()  — blocked in sandboxed iframes
 *   ✅ No OfflineAudioContext.createMediaElementSource — needs autoplay grant
 *   ✅ No ffmpeg.wasm      — breaks Vite module graph at startup
 *   ✅ No decodeAudioData on mp4 — browser demuxer unreliable
 *   ✅ muted video         — autoplay always allowed when muted
 */
export function extractAudioFromVideo(
  videoFile: File,
  onProgress?: (pct: number) => void
): Promise<{ pcm: Float32Array; sampleRate: number }> {
  return new Promise((resolve, reject) => {
    const objectURL = URL.createObjectURL(videoFile);

    const video = document.createElement('video');
    video.src          = objectURL;
    video.muted        = true;   // muted = always autoplayable, even in iframes
    video.playbackRate = 4.0;    // 4× speed → 24 min episode done in ~6 min
    video.style.cssText =
      'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;top:-10px;left:-10px';
    document.body.appendChild(video);

    function cleanup() {
      try { video.pause(); }             catch { /* ignore */ }
      try { document.body.removeChild(video); } catch { /* ignore */ }
      URL.revokeObjectURL(objectURL);
    }

    video.onerror = () => {
      cleanup();
      reject(new Error('Could not load video. Make sure it is a valid mp4, webm, or mkv file.'));
    };

    video.onloadedmetadata = () => {
      const duration = video.duration;
      if (!isFinite(duration) || duration <= 0) {
        cleanup();
        reject(new Error('Could not read video duration.'));
        return;
      }

      const CAPTURE_RATE = 44100;
      const TARGET_RATE  = 16000;

      let audioCtx: AudioContext;
      try {
        audioCtx = new AudioContext({ sampleRate: CAPTURE_RATE });
      } catch (e) {
        cleanup();
        reject(new Error('AudioContext not available: ' + (e as Error).message));
        return;
      }

      const source    = audioCtx.createMediaElementSource(video);
      // ScriptProcessorNode lets us capture raw PCM in real time.
      // Deprecated but universally supported — AudioWorklet needs HTTPS + COOP.
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      const collected: Float32Array[] = [];

      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        // Must copy — the underlying buffer is recycled after the event
        collected.push(new Float32Array(e.inputBuffer.getChannelData(0)));
        const pct = Math.min(99, Math.round((video.currentTime / duration) * 100));
        onProgress?.(pct);
      };

      // source → processor → destination (silent because video is muted)
      source.connect(processor);
      processor.connect(audioCtx.destination);

      video.onended = () => {
        processor.disconnect();
        source.disconnect();
        audioCtx.close();
        cleanup();
        onProgress?.(100);

        // Merge chunks
        const totalLen = collected.reduce((s, c) => s + c.length, 0);
        const full     = new Float32Array(totalLen);
        let offset = 0;
        for (const chunk of collected) { full.set(chunk, offset); offset += chunk.length; }

        // Downsample 44100 → 16000
        const pcm = resample(full, CAPTURE_RATE, TARGET_RATE);
        resolve({ pcm, sampleRate: TARGET_RATE });
      };

      // Play — always succeeds for muted video regardless of iframe sandbox
      video.play().catch((err) => {
        processor.disconnect();
        source.disconnect();
        audioCtx.close();
        cleanup();
        reject(new Error('Video play() failed: ' + (err as Error).message));
      });
    };
  });
}

/** Linear interpolation resample */
function resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input;
  const ratio  = fromRate / toRate;
  const length = Math.round(input.length / ratio);
  const output = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const pos = i * ratio;
    const idx = Math.floor(pos);
    const f   = pos - idx;
    const a   = input[idx]     ?? 0;
    const b   = input[idx + 1] ?? 0;
    output[i] = a + f * (b - a);
  }
  return output;
}
