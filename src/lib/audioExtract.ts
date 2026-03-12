/**
 * audioExtract.ts
 *
 * Extracts a mono 16 kHz PCM Float32Array from ANY video file.
 *
 * Uses @ffmpeg/ffmpeg with the SINGLE-THREAD core loaded from unpkg CDN.
 * Single-thread mode does NOT require SharedArrayBuffer, so no
 * Cross-Origin-Embedder-Policy header is needed — the app works normally
 * in Replit previews and all sandboxed iframes.
 *
 * Pipeline:
 *   File  →  ffmpeg.wasm (demux + decode + resample to 16 kHz mono WAV)
 *         →  AudioContext.decodeAudioData (WAV is always decodeable)
 *         →  Float32Array PCM
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let _ffmpeg: FFmpeg | null = null;
let _loaded = false;

async function getFFmpeg(onProgress?: (pct: number) => void): Promise<FFmpeg> {
  if (_ffmpeg && _loaded) return _ffmpeg;

  _ffmpeg = new FFmpeg();

  // Single-thread core — no SharedArrayBuffer, no COEP header required
  // ~31 MB, cached by browser after first load
  const BASE = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

  await _ffmpeg.load({
    coreURL: await toBlobURL(`${BASE}/ffmpeg-core.js`,   'text/javascript'),
    wasmURL: await toBlobURL(`${BASE}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  _ffmpeg.on('progress', ({ progress }) => {
    onProgress?.(15 + Math.round(progress * 70));
  });

  _loaded = true;
  return _ffmpeg;
}

export async function extractAudioFromVideo(
  videoFile: File,
  onProgress?: (pct: number) => void
): Promise<{ pcm: Float32Array; sampleRate: number }> {
  const TARGET_RATE = 16000;

  onProgress?.(2);

  // 1. Boot ffmpeg (cached after first use)
  const ffmpeg = await getFFmpeg(onProgress);
  onProgress?.(15);

  // 2. Write input into ffmpeg virtual FS
  const ext        = getExt(videoFile.name);
  const inputName  = `input${ext}`;
  const outputName = 'audio.wav';

  await ffmpeg.writeFile(inputName, await fetchFile(videoFile));
  onProgress?.(25);

  // 3. Demux + resample to 16 kHz mono WAV
  await ffmpeg.exec([
    '-i',      inputName,
    '-vn',                    // strip video track
    '-acodec', 'pcm_s16le',   // raw 16-bit PCM
    '-ar',     String(TARGET_RATE),
    '-ac',     '1',           // mono
    outputName,
  ]);
  onProgress?.(85);

  // 4. Read the WAV back
  const wavData = await ffmpeg.readFile(outputName) as Uint8Array;

  // 5. Tidy up virtual FS
  await ffmpeg.deleteFile(inputName).catch(() => {});
  await ffmpeg.deleteFile(outputName).catch(() => {});
  onProgress?.(90);

  // 6. Decode WAV → AudioBuffer (WAV always decodes fine)
  const ctx      = new AudioContext({ sampleRate: TARGET_RATE });
  const audioBuf = await ctx.decodeAudioData(
    wavData.buffer.slice(wavData.byteOffset, wavData.byteOffset + wavData.byteLength)
  );
  ctx.close();
  onProgress?.(100);

  return { pcm: toMono(audioBuf), sampleRate: TARGET_RATE };
}

function getExt(name: string): string {
  const m = name.match(/\.[^.]+$/);
  return m ? m[0].toLowerCase() : '.mp4';
}

function toMono(buf: AudioBuffer): Float32Array {
  const numCh = buf.numberOfChannels;
  const len   = buf.length;
  const mono  = new Float32Array(len);
  for (let ch = 0; ch < numCh; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) mono[i] += d[i] / numCh;
  }
  return mono;
}
