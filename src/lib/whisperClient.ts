/**
 * whisperClient.ts
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

let worker: Worker | null = null;
let loadedModel: string | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL('./transcribeWorker.ts', import.meta.url),
      { type: 'module' }
    );
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
      // Forward all progress payloads from the worker to the UI callback
      if (d.type === 'progress' && d.data) {
        onProgress(d.data as TranscribeProgressEvent);
        return;
      }
      if (d.type === 'error') {
        w.removeEventListener('message', handler);
        reject(new Error(d.message ?? 'Worker error'));
        return;
      }
      if (d.type === replyType) {
        w.removeEventListener('message', handler);
        resolve(d);
      }
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

/**
 * Main entry point.
 * onProgress is now passed IN so it is registered before ANY async
 * work begins — eliminates the race condition where early 'initiate' /
 * 'download' events fired before TranscribePanel registered its callback.
 */
export async function transcribeVideoFile(
  file: File,
  model = 'Xenova/whisper-tiny',
  onProgress: ProgressCallback = () => {}
): Promise<SubtitleLine[]> {

  // 1. Decode audio — callback already registered, no race
  onProgress({ status: 'decoding' });
  const mono = await decodeToMono16k(file);
  onProgress({ status: 'decoded' });

  const w = getWorker();

  // 2. Load model (skip if same model already loaded in this worker)
  if (loadedModel !== model) {
    // workerRoundTrip passes onProgress so every initiate/download/progress
    // /done event from @xenova reaches the UI in real time
    await workerRoundTrip(w, { type: 'load', model }, [], 'ready', onProgress);
    loadedModel = model;
  }

  // 3. Always fire 'ready' so the UI transitions OUT of loading-model.
  //    When the model is cached, @xenova fires no download events and no
  //    'done' — without this explicit emit the UI would be stuck forever.
  onProgress({ status: 'ready' });

  // 4. Split audio into 30-second chunks with 1-second overlap
  const SAMPLE_RATE  = 16000;
  const CHUNK_FRAMES = 30 * SAMPLE_RATE;
  const OVERLAP      = 1  * SAMPLE_RATE;
  const step         = CHUNK_FRAMES - OVERLAP;
  const chunks: { data: Float32Array; offsetSec: number }[] = [];

  for (let start = 0; start < mono.length; start += step) {
    const end = Math.min(start + CHUNK_FRAMES, mono.length);
    chunks.push({ data: mono.slice(start, end), offsetSec: start / SAMPLE_RATE });
  }

  const totalChunks = chunks.length;
  const allLines: SubtitleLine[] = [];
  let lineOffset = 0;

  // 5. Transcribe chunks sequentially, stream partial results
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

    onProgress({
      status:       'partial',
      chunkIndex:   i + 1,
      totalChunks,
      partialLines: [...allLines],
    });
  }

  return allLines;
}

export function destroyWorker(): void {
  worker?.terminate();
  worker      = null;
  loadedModel = null;
}
