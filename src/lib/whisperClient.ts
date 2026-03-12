/**
 * whisperClient.ts — In-browser transcription via Transformers.js Web Worker.
 * Audio is extracted from video via MediaRecorder (audioExtract.ts),
 * NOT via AudioContext.decodeAudioData (which can't handle mp4/mkv containers).
 */
import type { SubtitleLine } from '../types/index';
import { extractAudioFromVideo } from './audioExtract';

export type TranscribeProgressEvent = {
  status: 'initiate' | 'download' | 'progress' | 'done' | 'ready' | 'extracting';
  name?: string;
  progress?: number;
  file?: string;
};

type ProgressCallback = (event: TranscribeProgressEvent) => void;

let worker: Worker | null = null;
let progressCb: ProgressCallback | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./transcribeWorker.ts', import.meta.url), { type: 'module' });
  }
  return worker;
}

export function onTranscribeProgress(cb: ProgressCallback): void {
  progressCb = cb;
}

export function transcribeAudioBuffer(
  pcm: Float32Array,
  sampleRate: number,
  model = 'Xenova/whisper-small'
): Promise<SubtitleLine[]> {
  return new Promise((resolve, reject) => {
    const w = getWorker();
    // Clone so we can transfer ownership safely
    const mono = pcm.slice();
    function onMessage(e: MessageEvent) {
      const { type, lines, data, message } = e.data;
      if (type === 'progress' && data && progressCb) progressCb(data);
      else if (type === 'result' && lines) { w.removeEventListener('message', onMessage); resolve(lines); }
      else if (type === 'error') { w.removeEventListener('message', onMessage); reject(new Error(message ?? 'Transcription failed')); }
    }
    w.addEventListener('message', onMessage);
    w.postMessage({ type: 'transcribe', audioData: mono, sampleRate, model }, [mono.buffer]);
  });
}

/**
 * Main entry point: extract audio from any video File, then transcribe.
 * Works with mp4, mkv, webm — anything the browser can play.
 */
export async function transcribeVideoFile(
  file: File,
  model = 'Xenova/whisper-small'
): Promise<SubtitleLine[]> {
  // Step 1: extract audio via MediaRecorder (handles mp4, mkv, webm, etc.)
  progressCb?.({ status: 'extracting', progress: 0 });
  const { pcm, sampleRate } = await extractAudioFromVideo(file, (pct) => {
    progressCb?.({ status: 'extracting', progress: pct });
  });

  // Step 2: send PCM to Whisper worker
  return transcribeAudioBuffer(pcm, sampleRate, model);
}

export function destroyWorker(): void {
  worker?.terminate();
  worker = null;
}
