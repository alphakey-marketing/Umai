/**
 * transcribeWorker.ts
 * Receives already-decoded mono 16kHz Float32Array from main thread.
 * Only responsible for: loading Whisper model + running inference.
 *
 * Message IN:  { type: 'transcribe', audioData: Float32Array, model: string }
 * Message OUT: { type: 'progress', data } | { type: 'chunk', chunkIndex, totalChunks } | { type: 'result', lines } | { type: 'error', message }
 */
import type { SubtitleLine } from '../types/index';

type WhisperChunk = { timestamp: [number, number | null]; text: string };
type PipelineFn = (input: Float32Array, opts: object) => Promise<{ chunks?: WhisperChunk[] }>;

let currentModel = '';
let transcriber: PipelineFn | null = null;

async function getTranscriber(model: string): Promise<PipelineFn> {
  if (transcriber && currentModel === model) return transcriber;
  transcriber  = null;
  currentModel = model;

  // @ts-ignore — CDN URL is intentional; tsc cannot resolve it but browser can
  // @vite-ignore
  const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js') as {
    pipeline: (task: string, model: string, opts: object) => Promise<PipelineFn>;
    env: { allowLocalModels: boolean; useBrowserCache: boolean };
  };

  env.allowLocalModels = false;
  env.useBrowserCache  = true;

  transcriber = await pipeline(
    'automatic-speech-recognition',
    model,
    {
      progress_callback: (data: unknown) => {
        self.postMessage({ type: 'progress', data });
      },
    }
  );

  return transcriber!;
}

self.onmessage = async (event: MessageEvent) => {
  const { type, audioData, model } = event.data as {
    type: string;
    audioData: Float32Array;
    model: string;
  };

  if (type !== 'transcribe') return;

  try {
    if (!audioData || audioData.length === 0) {
      throw new Error('Received empty audio data.');
    }

    // whisper-tiny is ~4x faster than whisper-small with good Japanese accuracy
    const resolvedModel = model ?? 'Xenova/whisper-tiny';
    const pipe = await getTranscriber(resolvedModel);
    self.postMessage({ type: 'progress', data: { status: 'ready' } });

    // Calculate total chunks so UI can show X / Y progress
    const CHUNK_S  = 30;
    const STRIDE_S = 5;
    const durationS = audioData.length / 16000;
    const totalChunks = Math.max(1, Math.ceil(durationS / (CHUNK_S - STRIDE_S)));
    let chunkIndex = 0;

    const output = await pipe(audioData, {
      language: 'japanese',
      task: 'transcribe',
      return_timestamps: 'word',
      chunk_length_s: CHUNK_S,
      stride_length_s: STRIDE_S,
      // Called after each chunk is decoded
      chunk_callback: (_chunk: unknown) => {
        chunkIndex += 1;
        self.postMessage({ type: 'chunk', chunkIndex, totalChunks });
      },
    }) as { chunks?: WhisperChunk[] };

    const lines = chunksToSubtitleLines(output.chunks ?? []);
    self.postMessage({ type: 'result', lines });
  } catch (err) {
    self.postMessage({ type: 'error', message: String((err as Error)?.message ?? err) });
  }
};

function chunksToSubtitleLines(chunks: WhisperChunk[]): SubtitleLine[] {
  const lines: SubtitleLine[] = [];
  let buffer: WhisperChunk[] = [];
  let idx = 0;
  function flush() {
    if (!buffer.length) return;
    const start = buffer[0].timestamp[0];
    const end   = buffer[buffer.length - 1].timestamp[1] ?? buffer[buffer.length - 1].timestamp[0] + 2;
    const text  = buffer.map(c => c.text).join('').trim();
    if (text) lines.push({ index: ++idx, start_ms: Math.round(start * 1000), end_ms: Math.round(end * 1000), text });
    buffer = [];
  }
  for (const chunk of chunks) {
    buffer.push(chunk);
    if (/[。！？!?]/.test(chunk.text) || buffer.length >= 10) flush();
  }
  flush();
  return lines;
}
