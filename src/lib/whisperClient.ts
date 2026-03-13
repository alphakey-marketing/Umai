/**
 * whisperClient.ts
 * Decodes audio on the main thread (OfflineAudioContext works here),
 * then transfers raw Float32Array PCM to the worker for Whisper inference.
 */
import type { SubtitleLine } from '../types/index';

export type TranscribeProgressEvent = {
  status: 'decoding' | 'decoded' | 'initiate' | 'download' | 'progress' | 'done' | 'ready';
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

/** Decode any audio/video file to mono 16kHz Float32Array on the main thread */
async function decodeToMono16k(file: File): Promise<Float32Array> {
  const arrayBuffer = await file.arrayBuffer();

  // Decode at native sample rate first
  const tmpCtx  = new AudioContext();
  const decoded = await tmpCtx.decodeAudioData(arrayBuffer);
  await tmpCtx.close();

  const native       = decoded.sampleRate;
  const frames       = decoded.length;
  const targetRate   = 16000;
  const targetFrames = Math.ceil(frames * (targetRate / native));

  // Resample to 16kHz via OfflineAudioContext
  const offCtx = new OfflineAudioContext(1, targetFrames, targetRate);
  const src    = offCtx.createBufferSource();
  src.buffer   = decoded;
  src.connect(offCtx.destination);
  src.start(0);
  const rendered = await offCtx.startRendering();
  return rendered.getChannelData(0).slice(); // slice() to detach from AudioBuffer
}

export async function transcribeVideoFile(
  file: File,
  model = 'Xenova/whisper-small'
): Promise<SubtitleLine[]> {
  // Step 1: decode on main thread
  progressCb?.({ status: 'decoding' });
  const mono = await decodeToMono16k(file);
  progressCb?.({ status: 'decoded' });

  // Step 2: send PCM to worker for model download + inference
  return new Promise((resolve, reject) => {
    const w = getWorker();
    function onMessage(e: MessageEvent) {
      const { type, lines, data, message } = e.data;
      if (type === 'progress' && data) {
        progressCb?.(data as TranscribeProgressEvent);
      } else if (type === 'result' && lines) {
        w.removeEventListener('message', onMessage);
        resolve(lines);
      } else if (type === 'error') {
        w.removeEventListener('message', onMessage);
        reject(new Error(message ?? 'Transcription failed'));
      }
    }
    w.addEventListener('message', onMessage);
    // Transfer buffer zero-copy
    w.postMessage({ type: 'transcribe', audioData: mono, model }, [mono.buffer]);
  });
}

/** For callers that already have a decoded AudioBuffer */
export function transcribeAudioBuffer(
  audioBuffer: AudioBuffer,
  model = 'Xenova/whisper-small'
): Promise<SubtitleLine[]> {
  const numChannels = audioBuffer.numberOfChannels;
  const length      = audioBuffer.length;
  const mono        = new Float32Array(length);
  for (let ch = 0; ch < numChannels; ch++) {
    const ch_data = audioBuffer.getChannelData(ch);
    for (let i = 0; i < length; i++) mono[i] += ch_data[i] / numChannels;
  }
  return new Promise((resolve, reject) => {
    const w = getWorker();
    function onMessage(e: MessageEvent) {
      const { type, lines, data, message } = e.data;
      if      (type === 'progress' && data)  progressCb?.(data);
      else if (type === 'result'   && lines) { w.removeEventListener('message', onMessage); resolve(lines); }
      else if (type === 'error')             { w.removeEventListener('message', onMessage); reject(new Error(message ?? 'Transcription failed')); }
    }
    w.addEventListener('message', onMessage);
    w.postMessage({ type: 'transcribe', audioData: mono, model }, [mono.buffer]);
  });
}

export function destroyWorker(): void {
  worker?.terminate();
  worker = null;
}
