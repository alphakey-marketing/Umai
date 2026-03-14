/**
 * whisperClient.ts
 *
 * Vite 3 does not support ES-module workers bundled via import.meta.url.
 * We work around this by creating the worker from a Blob URL at runtime.
 * The blob is same-origin, so the browser's CSP never blocks importScripts.
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

export type ProgressCallback = (event: TranscribeProgressEvent) => void;

// ---------------------------------------------------------------------------
// Worker script embedded as a string so Vite 3 never tries to bundle it.
// importScripts() in a Blob worker is same-origin → no CSP block.
// ---------------------------------------------------------------------------
const WORKER_SCRIPT = /* javascript */ `
const CDN = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js';

let loaded = false;
function ensureLib() {
  if (loaded) return;
  importScripts(CDN);
  loaded = true;
}

let currentModel = '';
let transcriber  = null;

async function getTranscriber(model) {
  if (transcriber && currentModel === model) return transcriber;
  transcriber  = null;
  currentModel = model;
  ensureLib();
  const { pipeline, env } = self.transformers;
  env.allowLocalModels = false;
  env.useBrowserCache  = true;
  transcriber = await pipeline(
    'automatic-speech-recognition',
    model,
    { progress_callback: (data) => self.postMessage({ type: 'progress', data }) }
  );
  return transcriber;
}

self.onmessage = async (event) => {
  const msg = event.data;

  if (msg.type === 'load') {
    try {
      await getTranscriber(msg.model || 'Xenova/whisper-tiny');
      self.postMessage({ type: 'ready' });
    } catch (err) {
      self.postMessage({ type: 'error', message: String(err && err.message ? err.message : err) });
    }
    return;
  }

  if (msg.type === 'transcribe') {
    const { audioData, chunkIndex = 0, totalChunks = 1, model, offsetSec = 0 } = msg;
    try {
      const pipe   = await getTranscriber(model || 'Xenova/whisper-tiny');
      const output = await pipe(audioData, {
        language: 'japanese',
        task: 'transcribe',
        return_timestamps: 'word',
      });
      const chunks = output.chunks || [];
      const shifted = chunks.map(c => ({
        text: c.text,
        timestamp: [
          c.timestamp[0] + offsetSec,
          c.timestamp[1] != null ? c.timestamp[1] + offsetSec : null,
        ],
      }));
      const lines = wordsToSubtitleLines(shifted);
      self.postMessage({ type: 'chunkResult', lines, chunkIndex, totalChunks });
    } catch (err) {
      self.postMessage({ type: 'error', message: String(err && err.message ? err.message : err) });
    }
    return;
  }
};

function wordsToSubtitleLines(words) {
  const LONG_PAUSE     = 0.5;
  const SHORT_PAUSE    = 0.3;
  const MAX_DURATION_S = 8.0;
  const MAX_WORDS      = 15;
  const PUNCT          = /[\u3002\u3001\uff01\uff1f!?,\uff0c]/;
  const lines  = [];
  let buffer   = [];
  let lineIdx  = 0;

  function flush() {
    if (!buffer.length) return;
    const start = buffer[0].timestamp[0];
    const last  = buffer[buffer.length - 1];
    const end   = last.timestamp[1] != null ? last.timestamp[1] : last.timestamp[0] + 0.5;
    const text  = buffer.map(w => w.text).join('').trim();
    if (text) lines.push({ index: ++lineIdx, start_ms: Math.round(start*1000), end_ms: Math.round(end*1000), text });
    buffer = [];
  }

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const next = words[i + 1];
    buffer.push(word);
    const wordEnd     = word.timestamp[1] != null ? word.timestamp[1] : word.timestamp[0] + 0.2;
    const gap         = next ? next.timestamp[0] - wordEnd : 999;
    const bufDuration = wordEnd - buffer[0].timestamp[0];
    const hasPunct    = PUNCT.test(word.text);
    if (gap >= LONG_PAUSE || (gap >= SHORT_PAUSE && hasPunct) || bufDuration >= MAX_DURATION_S || buffer.length >= MAX_WORDS)
      flush();
  }
  flush();
  return lines;
}
`;

// ---------------------------------------------------------------------------
// Worker lifecycle
// ---------------------------------------------------------------------------
let worker:      Worker | null = null;
let loadedModel: string | null = null;

function getWorker(): Worker {
  if (!worker) {
    const blob = new Blob([WORKER_SCRIPT], { type: 'application/javascript' });
    const url  = URL.createObjectURL(blob);
    worker      = new Worker(url);   // classic worker — no {type:'module'}
    loadedModel = null;
  }
  return worker;
}

function workerRoundTrip(
  w: Worker,
  msg: object,
  transfer: Transferable[],
  replyType: string,
  onProgress: ProgressCallback
): Promise<MessageEvent['data']> {
  return new Promise((resolve, reject) => {
    function handler(e: MessageEvent) {
      const d = e.data;
      if (d.type === 'progress' && d.data) { onProgress(d.data as TranscribeProgressEvent); return; }
      if (d.type === 'error')              { w.removeEventListener('message', handler); reject(new Error(d.message ?? 'Worker error')); return; }
      if (d.type === replyType)            { w.removeEventListener('message', handler); resolve(d); }
    }
    w.addEventListener('message', handler);
    w.postMessage(msg, transfer);
  });
}

function deduplicateLines(existing: SubtitleLine[], incoming: SubtitleLine[]): SubtitleLine[] {
  if (!existing.length) return incoming;
  const lastStart = existing[existing.length - 1].start_ms;
  return incoming.filter(l => l.start_ms > lastStart + 1500);
}

export async function decodeToMono16k(file: File): Promise<Float32Array> {
  const buf      = await file.arrayBuffer();
  const tmpCtx   = new AudioContext();
  const decoded  = await tmpCtx.decodeAudioData(buf);
  await tmpCtx.close();
  const targetRate   = 16000;
  const targetFrames = Math.ceil(decoded.length * (targetRate / decoded.sampleRate));
  const offCtx = new OfflineAudioContext(1, targetFrames, targetRate);
  const src    = offCtx.createBufferSource();
  src.buffer   = decoded;
  src.connect(offCtx.destination);
  src.start(0);
  const rendered = await offCtx.startRendering();
  return rendered.getChannelData(0).slice();
}

export async function transcribeVideoFile(
  file: File,
  model = 'Xenova/whisper-tiny',
  onProgress: ProgressCallback = () => {}
): Promise<SubtitleLine[]> {

  onProgress({ status: 'decoding' });
  const mono = await decodeToMono16k(file);
  onProgress({ status: 'decoded' });

  const w = getWorker();

  if (loadedModel !== model) {
    await workerRoundTrip(w, { type: 'load', model }, [], 'ready', onProgress);
    loadedModel = model;
  }
  // Always fire 'ready' — covers cached-model case where @xenova emits nothing
  onProgress({ status: 'ready' });

  const SAMPLE_RATE  = 16000;
  const CHUNK_FRAMES = 30 * SAMPLE_RATE;
  const step         = CHUNK_FRAMES - SAMPLE_RATE; // 1s overlap
  const chunks: { data: Float32Array; offsetSec: number }[] = [];
  for (let start = 0; start < mono.length; start += step) {
    chunks.push({ data: mono.slice(start, Math.min(start + CHUNK_FRAMES, mono.length)), offsetSec: start / SAMPLE_RATE });
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
      'chunkResult',
      onProgress
    ) as { lines: SubtitleLine[] };

    const deduped   = deduplicateLines(allLines, result.lines);
    const reindexed = deduped.map((l, j) => ({ ...l, index: lineOffset + j + 1 }));
    lineOffset     += reindexed.length;
    allLines.push(...reindexed);
    onProgress({ status: 'partial', chunkIndex: i + 1, totalChunks, partialLines: [...allLines] });
  }

  return allLines;
}

export function destroyWorker(): void {
  worker?.terminate();
  worker      = null;
  loadedModel = null;
}
