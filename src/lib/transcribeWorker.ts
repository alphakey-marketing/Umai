/**
 * transcribeWorker.ts
 * Receives already-decoded mono 16kHz Float32Array from main thread.
 * Only responsible for: loading Whisper model + running inference.
 *
 * Message IN:  { type: 'transcribe', audioData: Float32Array, model: string }
 * Message OUT: { type: 'progress', data } | { type: 'result', lines } | { type: 'error', message }
 *
 * NOTE: We use dynamic import() instead of a static top-level import so that
 * Vite does not attempt to bundle @xenova/transformers in iife worker format,
 * which breaks ES module loading. Dynamic import() is left as-is by Vite.
 */
import type { SubtitleLine } from '../types/index';

type WhisperChunk = { timestamp: [number, number | null]; text: string };

let currentModel = '';
let transcriber: unknown = null;

async function getTranscriber(model: string) {
  if (transcriber && currentModel === model) return transcriber;
  transcriber  = null;
  currentModel = model;

  // Dynamic import avoids Vite bundling @xenova/transformers in iife format
  const { pipeline, env } = await import('@xenova/transformers');
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
  return transcriber;
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

    const pipe = await getTranscriber(model ?? 'Xenova/whisper-small') as (input: Float32Array, opts: object) => Promise<{ chunks?: WhisperChunk[] }>;
    self.postMessage({ type: 'progress', data: { status: 'ready' } });

    const output = await pipe(audioData, {
      language: 'japanese',
      task: 'transcribe',
      return_timestamps: 'word',
      chunk_length_s: 30,
      stride_length_s: 5,
    });

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
