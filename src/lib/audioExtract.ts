/**
 * audioExtract.ts
 *
 * Extracts a mono 16 kHz PCM Float32Array from ANY video file the user uploads.
 *
 * Uses @ffmpeg/ffmpeg (wasm) which runs entirely in-browser with no server,
 * no captureStream(), no AudioContext.decodeAudioData() on a video container.
 * Works in sandboxed iframes (Replit preview), cross-origin frames, everywhere.
 *
 * Pipeline:
 *   File  →  ffmpeg.wasm (demux + decode + resample to 16 kHz mono WAV)
 *         →  AudioContext.decodeAudioData (WAV is always decodeable)
 *         →  Float32Array PCM
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let _ffmpeg: FFmpeg | null = null;

async function getFFmpeg(onProgress?: (pct: number) => void): Promise<FFmpeg> {
  if (_ffmpeg?.loaded) return _ffmpeg;
  _ffmpeg = new FFmpeg();

  // Load ffmpeg core from CDN (cached by browser after first load, ~31 MB)
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  _ffmpeg.on('progress', ({ progress }) => {
    // ffmpeg processing progress (0-1)
    onProgress?.(10 + Math.round(progress * 70));
  });

  await _ffmpeg.load({
    coreURL:   await toBlobURL(`${baseURL}/ffmpeg-core.js`,   'text/javascript'),
    wasmURL:   await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  return _ffmpeg;
}

export async function extractAudioFromVideo(
  videoFile: File,
  onProgress?: (pct: number) => void
): Promise<{ pcm: Float32Array; sampleRate: number }> {
  const TARGET_RATE = 16000;

  onProgress?.(2);

  // 1. Load ffmpeg.wasm (cached after first use)
  const ffmpeg = await getFFmpeg(onProgress);
  onProgress?.(10);

  // 2. Write the input file into ffmpeg's virtual FS
  const inputName  = 'input' + getExtension(videoFile.name);
  const outputName = 'audio.wav';
  await ffmpeg.writeFile(inputName, await fetchFile(videoFile));
  onProgress?.(20);

  // 3. Extract + resample to 16 kHz mono WAV
  await ffmpeg.exec([
    '-i', inputName,
    '-vn',                   // drop video track
    '-acodec', 'pcm_s16le',  // raw PCM
    '-ar', String(TARGET_RATE),
    '-ac', '1',              // mono
    outputName,
  ]);
  onProgress?.(85);

  // 4. Read the output WAV
  const wavData = await ffmpeg.readFile(outputName) as Uint8Array;

  // 5. Clean up virtual FS
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);
  onProgress?.(90);

  // 6. Decode WAV → AudioBuffer (WAV is always decodeable by AudioContext)
  const audioCtx = new AudioContext({ sampleRate: TARGET_RATE });
  const audioBuf = await audioCtx.decodeAudioData(wavData.buffer.slice(
    wavData.byteOffset,
    wavData.byteOffset + wavData.byteLength
  ));
  audioCtx.close();
  onProgress?.(100);

  return { pcm: toMono(audioBuf), sampleRate: TARGET_RATE };
}

function getExtension(filename: string): string {
  const m = filename.match(/\.[^.]+$/);
  return m ? m[0] : '.mp4';
}

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
