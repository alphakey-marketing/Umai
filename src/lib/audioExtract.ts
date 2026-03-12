/**
 * audioExtract.ts
 *
 * Extracts audio from a video File for Whisper transcription.
 *
 * Strategy: fetch the File as an ArrayBuffer, try AudioContext.decodeAudioData
 * directly (works for mp4/aac on Chrome/Edge/Safari which ship a full demuxer).
 * If that fails (e.g. Firefox with some mp4 variants), fall back to an
 * OfflineAudioContext render via a MediaElementSource.
 *
 * This avoids captureStream() which is blocked in sandboxed iframes (Replit preview)
 * and requires user-gesture / non-muted playback in many browsers.
 */

export async function extractAudioFromVideo(
  videoFile: File,
  onProgress?: (pct: number) => void
): Promise<{ pcm: Float32Array; sampleRate: number }> {
  onProgress?.(5);

  const TARGET_RATE = 16000;

  // ── Strategy A: direct decodeAudioData ──────────────────────────────────
  // Chrome, Edge and Safari can fully demux mp4/aac/mp3 inside AudioContext.
  // This is the fastest path and works fine in sandboxed iframes.
  try {
    const arrayBuffer = await videoFile.arrayBuffer();
    onProgress?.(30);
    const ctx    = new AudioContext({ sampleRate: TARGET_RATE });
    const audioBuf = await ctx.decodeAudioData(arrayBuffer.slice(0));
    ctx.close();
    onProgress?.(90);
    return { pcm: toMono(audioBuf), sampleRate: TARGET_RATE };
  } catch (_directErr) {
    // Strategy A failed — fall through to B
  }

  // ── Strategy B: MediaElement + Web Audio offline render ─────────────────
  // Creates a real <audio> element (not <video>) which the browser decodes
  // natively, then renders offline via OfflineAudioContext.
  // Works in Firefox for mp4 when direct decoding fails.
  onProgress?.(35);
  return new Promise((resolve, reject) => {
    const objectURL = URL.createObjectURL(videoFile);
    const audioEl   = document.createElement('audio');
    audioEl.preload = 'auto';
    audioEl.src     = objectURL;

    audioEl.onerror = () => {
      URL.revokeObjectURL(objectURL);
      reject(new Error(
        'Browser cannot decode this file\'s audio track. ' +
        'Try re-encoding to mp4 (H.264 + AAC) or webm (VP9 + Opus).'
      ));
    };

    audioEl.onloadedmetadata = async () => {
      try {
        const duration    = audioEl.duration;              // seconds
        const numSamples  = Math.ceil(duration * TARGET_RATE);
        const offlineCtx  = new OfflineAudioContext(1, numSamples, TARGET_RATE);

        const source = offlineCtx.createMediaElementSource(audioEl);
        source.connect(offlineCtx.destination);

        // Render progress: poll via oncomplete isn't incremental, so just
        // fire a mid-point tick before startRendering.
        onProgress?.(50);
        audioEl.play().catch(() => {/* ignore autoplay restriction — offlineCtx renders without it */});
        const rendered = await offlineCtx.startRendering();
        audioEl.pause();
        URL.revokeObjectURL(objectURL);
        onProgress?.(95);
        resolve({ pcm: toMono(rendered), sampleRate: TARGET_RATE });
      } catch (e) {
        URL.revokeObjectURL(objectURL);
        reject(e);
      }
    };
  });
}

// ── helpers ──────────────────────────────────────────────────────────────

function toMono(buf: AudioBuffer): Float32Array {
  const numCh = buf.numberOfChannels;
  const len   = buf.length;
  const mono  = new Float32Array(len);
  for (let ch = 0; ch < numCh; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) mono[i] += data[i] / numCh;
  }
  return mono;
}
