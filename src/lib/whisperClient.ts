/**
 * whisperClient.ts — In-browser transcription via Transformers.js Web Worker.
 * Model is passed in at call time so Settings changes take effect immediately.
 */

import type { SubtitleLine } from '../types';

export type TranscribeProgressEvent = {
  status: 'initiate' | 'download' | 'progress' | 'done' | 'ready';
  name?: string;
  progress?: number;
  file?: string;
};

type ProgressCallback = (event: TranscribeProgressEvent) => void;

let worker: Worker | null     = null;
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
  audioBuffer: AudioBuffer,
  model = 'Xenova/whisper-small'
): Promise<SubtitleLine[]> {
  return new Promise((resolve, reject) => {
    const w = getWorker();
    const numChannels = audioBuffer.numberOfChannels;
    const length      = audioBuffer.length;
    const mono        = new Float32Array(length);
    for (let ch = 0; ch < numChannels; ch++) {
      const channel = audioBuffer.getChannelData(ch);
      for (let i = 0; i < length; i++) mono[i] += channel[i] / numChannels;
    }
    function onMessage(e: MessageEvent) {
      const { type, lines, data, message } = e.data;
      if (type === 'progress' && data && progressCb) progressCb(data);
      else if (type === 'result' && lines) { w.removeEventListener('message', onMessage); resolve(lines); }
      else if (type === 'error') { w.removeEventListener('message', onMessage); reject(new Error(message ?? 'Transcription failed')); }
    }
    w.addEventListener('message', onMessage);
    w.postMessage({ type: 'transcribe', audioData: mono, sampleRate: audioBuffer.sampleRate, model }, [mono.buffer]);
  });
}

export async function transcribeVideoFile(
  file: File,
  model  = 'Xenova/whisper-small',
  offsetS = 0,
  durationS?: number
): Promise<SubtitleLine[]> {
  const arrayBuffer  = await file.arrayBuffer();
  const audioCtx     = new AudioContext({ sampleRate: 16000 });
  const audioBuffer  = await audioCtx.decodeAudioData(arrayBuffer);
  audioCtx.close();
  if (offsetS === 0 && !durationS) return transcribeAudioBuffer(audioBuffer, model);
  const startSample  = Math.floor(offsetS * audioBuffer.sampleRate);
  const endSample    = durationS
    ? Math.min(startSample + Math.floor(durationS * audioBuffer.sampleRate), audioBuffer.length)
    : audioBuffer.length;
  const sliceCtx     = new OfflineAudioContext(1, endSample - startSample, audioBuffer.sampleRate);
  const src          = sliceCtx.createBufferSource();
  src.buffer         = audioBuffer;
  src.connect(sliceCtx.destination);
  src.start(0, offsetS, durationS);
  const sliced       = await sliceCtx.startRendering();
  return transcribeAudioBuffer(sliced, model);
}

export function destroyWorker(): void {
  worker?.terminate();
  worker = null;
}
