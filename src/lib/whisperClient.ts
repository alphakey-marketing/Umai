/**
 * whisperClient.ts — In-browser transcription via Transformers.js
 *
 * Uses @xenova/transformers running entirely in a Web Worker.
 * - FREE: no API key, no server, no cost ever.
 * - First run: downloads whisper-small (~240 MB) and caches in browser IndexedDB.
 * - Subsequent runs: instant load from cache.
 *
 * Public API:
 *   transcribeAudioBuffer(audioBuffer)  → Promise<SubtitleLine[]>
 *   transcribeVideoFile(videoFile)      → Promise<SubtitleLine[]>
 *   onProgress(cb)                      → listen to model download progress
 */

import type { SubtitleLine } from '../types';

export type TranscribeProgressEvent = {
  status: 'initiate' | 'download' | 'progress' | 'done' | 'ready';
  name?: string;
  progress?: number;   // 0–100
  file?: string;
};

type ProgressCallback = (event: TranscribeProgressEvent) => void;

let worker: Worker | null = null;
let progressCb: ProgressCallback | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL('./transcribeWorker.ts', import.meta.url),
      { type: 'module' }
    );
  }
  return worker;
}

/** Register a callback for model download / transcription progress events. */
export function onTranscribeProgress(cb: ProgressCallback): void {
  progressCb = cb;
}

/**
 * Transcribe an AudioBuffer (already decoded PCM) → SubtitleLine[].
 * This is the lowest-level call — used internally by transcribeVideoFile.
 */
export function transcribeAudioBuffer(
  audioBuffer: AudioBuffer
): Promise<SubtitleLine[]> {
  return new Promise((resolve, reject) => {
    const w = getWorker();

    // Merge to mono by averaging all channels
    const numChannels = audioBuffer.numberOfChannels;
    const length      = audioBuffer.length;
    const mono        = new Float32Array(length);
    for (let ch = 0; ch < numChannels; ch++) {
      const channel = audioBuffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        mono[i] += channel[i] / numChannels;
      }
    }

    function onMessage(e: MessageEvent) {
      const { type, lines, data, message } = e.data as {
        type: string;
        lines?: SubtitleLine[];
        data?: TranscribeProgressEvent;
        message?: string;
      };

      if (type === 'progress' && data && progressCb) {
        progressCb(data);
      } else if (type === 'result' && lines) {
        w.removeEventListener('message', onMessage);
        resolve(lines);
      } else if (type === 'error') {
        w.removeEventListener('message', onMessage);
        reject(new Error(message ?? 'Transcription failed'));
      }
    }

    w.addEventListener('message', onMessage);
    w.postMessage(
      { type: 'transcribe', audioData: mono, sampleRate: audioBuffer.sampleRate },
      [mono.buffer]   // transfer ownership — avoids copying large buffer
    );
  });
}

/**
 * Transcribe a video or audio File directly.
 * Decodes audio via Web Audio API, then sends to the worker.
 *
 * @param file     - Any File (mp4, mkv, webm, mp3, m4a …)
 * @param offsetS  - Start offset in seconds (default 0)
 * @param durationS - How many seconds to transcribe (default: full file)
 */
export async function transcribeVideoFile(
  file: File,
  offsetS   = 0,
  durationS?: number
): Promise<SubtitleLine[]> {
  const arrayBuffer  = await file.arrayBuffer();
  const audioCtx     = new AudioContext({ sampleRate: 16000 });
  const audioBuffer  = await audioCtx.decodeAudioData(arrayBuffer);
  audioCtx.close();

  if (offsetS === 0 && !durationS) {
    return transcribeAudioBuffer(audioBuffer);
  }

  // Slice the AudioBuffer to the requested range
  const startSample  = Math.floor(offsetS * audioBuffer.sampleRate);
  const endSample    = durationS
    ? Math.min(startSample + Math.floor(durationS * audioBuffer.sampleRate), audioBuffer.length)
    : audioBuffer.length;
  const sliceLen     = endSample - startSample;
  const sliceCtx     = new OfflineAudioContext(1, sliceLen, audioBuffer.sampleRate);
  const src          = sliceCtx.createBufferSource();
  src.buffer         = audioBuffer;
  src.connect(sliceCtx.destination);
  src.start(0, offsetS, durationS);
  const sliced       = await sliceCtx.startRendering();

  return transcribeAudioBuffer(sliced);
}

/** Clean up the worker (call on component unmount if needed). */
export function destroyWorker(): void {
  worker?.terminate();
  worker = null;
}
