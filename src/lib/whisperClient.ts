/**
 * whisperClient.ts
 *
 * Decodes audio on the main thread, splits into 30s chunks,
 * sends each chunk to the worker one-at-a-time, streams
 * partial subtitle lines back, and deduplicates at boundaries.
 */
import type { SubtitleLine } from '../types/index';

export type TranscribeProgressEvent = {
  status:
    | 'decoding' | 'decoded'
    | 'initiate' | 'download' | 'progress' | 'done'
    | 'ready'
    | 'partial';
  name?: string;
  progress?: number;
  file?: string;
  chunkIndex?: number;
  totalChunks?: number;
  partialLines?: SubtitleLine[];
};

type ProgressCallback = (event: TranscribeProgressEvent) => void;

let worker: Worker | null = null;
let progressCb: ProgressCallback | null = null;
let loadedModel: string | null = null;

function getWorker(): Worker {
  if (!worker) {
    // ES module worker — Vite bundles transcribeWorker.ts and all its
    // imports (@xenova/transformers) into a single worker chunk.
    // vite.config.ts sets the worker esbuild target to esnext so BigInt
    // literals in the library are preserved (not transpiled away).
    worker = new Worker(
      new URL('./transcribeWorker.ts', import.meta.url),
      { type: 'module' }
    );
    loadedModel = null;
  }
  return worker;
}

export function onTranscribeProgress(cb: ProgressCallback): void {
  progressCb = cb;
}

export async function decodeToMono16k(file: File): Promise<Float32Array> {
  const arrayBuffer  = await file.arrayBuffer();
  const tmpCtx       = new AudioContext();
  const decoded      = await tmpCtx.decodeAudioData(arrayBuffer);
  await tmpCtx.close();
  const native       = decoded.sampleRate;
  const targetRate   = 16000;
  const targetFrames = Math.ceil(decoded.length * (targetRate / native));
  const offCtx = new OfflineAudioContext(1, targetFrames, targetRate);
  const src    = offCtx.createBufferSource();
  src.buffer   = decoded;
  src.connect(offCtx.destination);
  src.start(0);
  const rendered = await offCtx.startRendering();
  return rendered.getChannelData(0).slice();
}

function workerRoundTrip(
  w: Worker,
  msg: object,
  transfer: Transferable[],
  replyType: string
): Promise<MessageEvent['data']> {
  return new Promise((resolve, reject) => {
    function handler(e: MessageEvent) {
      const d = e.data;
      if (d.type === 'progress' && d.data) { progressCb?.(d.data as TranscribeProgressEvent); return; }
      if (d.type === 'error')              { w.removeEventListener('message', handler); reject(new Error(d.message ?? 'Worker error')); return; }
      if (d.type === replyType)            { w.removeEventListener('message', handler); resolve(d); }
    }
    w.addEventListener('message', handler);
    w.postMessage(msg, transfer);
  });
}

function deduplicateLines(
  existing: SubtitleLine[],
  incoming: SubtitleLine[]
): SubtitleLine[] {
  if (!existing.length) return incoming;
  const lastStart  = existing[existing.length - 1].start_ms;
  const OVERLAP_MS = 1500;
  return incoming.filter(l => l.start_ms > lastStart + OVERLAP_MS);
}

export async function transcribeVideoFile(
  file: File,
  model = 'Xenova/whisper-tiny'
): Promise<SubtitleLine[]> {
  progressCb?.({ status: 'decoding' });
  const mono = await decodeToMono16k(file);
  progressCb?.({ status: 'decoded' });

  const w = getWorker();

  if (loadedModel !== model) {
    await workerRoundTrip(w, { type: 'load', model }, [], 'ready');
    loadedModel = model;
  }
  progressCb?.({ status: 'ready' });

  const SAMPLE_RATE  = 16000;
  const CHUNK_FRAMES = 30 * SAMPLE_RATE;
  const OVERLAP      = 1  * SAMPLE_RATE;
  const step         = CHUNK_FRAMES - OVERLAP;
  const totalFrames  = mono.length;
  const chunks: { data: Float32Array; offsetSec: number }[] = [];

  for (let start = 0; start < totalFrames; start += step) {
    const end = Math.min(start + CHUNK_FRAMES, totalFrames);
    chunks.push({ data: mono.slice(start, end), offsetSec: start / SAMPLE_RATE });
  }

  const totalChunks = chunks.length;
  const allLines: SubtitleLine[] = [];
  let lineOffset = 0;

  for (let i = 0; i < chunks.length; i++) {
    const { data, offsetSec } = chunks[i];

    const result = await workerRoundTrip(
      w,
      { type: 'transcribe', audioData: data, model, chunkIndex: i + 1, totalChunks, offsetSec },
      [data.buffer],
      'chunkResult'
    ) as { lines: SubtitleLine[] };

    const deduped   = deduplicateLines(allLines, result.lines);
    const reindexed = deduped.map((l, j) => ({ ...l, index: lineOffset + j + 1 }));
    lineOffset     += reindexed.length;
    allLines.push(...reindexed);

    progressCb?.({
      status:       'partial',
      chunkIndex:   i + 1,
      totalChunks,
      partialLines: [...allLines],
    });
  }

  return allLines;
}

export function transcribeAudioBuffer(
  audioBuffer: AudioBuffer,
  model = 'Xenova/whisper-tiny'
): Promise<SubtitleLine[]> {
  const numChannels = audioBuffer.numberOfChannels;
  const length      = audioBuffer.length;
  const mono        = new Float32Array(length);
  for (let ch = 0; ch < numChannels; ch++) {
    const chData = audioBuffer.getChannelData(ch);
    for (let i = 0; i < length; i++) mono[i] += chData[i] / numChannels;
  }
  const blob = new Blob([mono.buffer], { type: 'audio/raw' });
  const file = new File([blob], 'audio.raw');
  return transcribeVideoFile(file, model);
}

export function destroyWorker(): void {
  worker?.terminate();
  worker = null;
  loadedModel = null;
}
