/**
 * whisperClient.ts — In-browser transcription via Transformers.js Web Worker.
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

export function transcribeRawPCM(
  pcm: Float32Array,
  sampleRate: number,
  model = 'Xenova/whisper-small'
): Promise<SubtitleLine[]> {
  return new Promise((resolve, reject) => {
    const w    = getWorker();
    const mono = pcm.slice();
    function onMessage(e: MessageEvent) {
      const { type, lines, data, message } = e.data;
      if      (type === 'progress' && progressCb) progressCb(data);
      else if (type === 'result')  { w.removeEventListener('message', onMessage); resolve(lines); }
      else if (type === 'error')   { w.removeEventListener('message', onMessage); reject(new Error(message ?? 'Transcription failed')); }
    }
    w.addEventListener('message', onMessage);
    w.postMessage({ type: 'transcribe', audioData: mono, sampleRate, model }, [mono.buffer]);
  });
}

export async function transcribeVideoFile(
  file: File,
  model = 'Xenova/whisper-small'
): Promise<SubtitleLine[]> {
  progressCb?.({ status: 'extracting', progress: 0 });
  const { pcm, sampleRate } = await extractAudioFromVideo(file, (pct) => {
    progressCb?.({ status: 'extracting', progress: pct });
  });
  return transcribeRawPCM(pcm, sampleRate, model);
}

export function destroyWorker(): void {
  worker?.terminate();
  worker = null;
}
