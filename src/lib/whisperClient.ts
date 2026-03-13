/**
 * whisperClient.ts — sends File bytes to the Whisper worker.
 *
 * All audio decoding happens inside the worker via OfflineAudioContext —
 * no DOM access, no user-gesture requirement, no MediaElementSource conflicts.
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

export async function transcribeVideoFile(
  file: File,
  model = 'Xenova/whisper-small'
): Promise<SubtitleLine[]> {
  const arrayBuffer = await file.arrayBuffer();

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
    // Transfer the ArrayBuffer — zero-copy, avoids duplicating large video files
    w.postMessage({ type: 'transcribe', arrayBuffer, model }, [arrayBuffer]);
  });
}

/** For external SRT-less flows that already have a decoded AudioBuffer */
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
    w.postMessage({ type: 'transcribe', arrayBuffer: mono.buffer, model }, [mono.buffer]);
  });
}

export function destroyWorker(): void {
  worker?.terminate();
  worker = null;
}
