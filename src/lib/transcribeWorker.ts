/**
 * transcribeWorker.ts
 * Receives already-decoded mono 16kHz Float32Array from main thread.
 * Only responsible for: loading Whisper model + running inference.
 *
 * Message IN:  { type: 'transcribe', audioData: Float32Array, model: string }
 * Message OUT: { type: 'progress', data } | { type: 'result', lines } | { type: 'error', message }
 *
 * NOTE: We import directly from CDN to bypass Vite 3's broken worker bundling.
 * Vite 3 mangles @xenova/transformers even with optimizeDeps.exclude, causing
 * ONNX registerBackend errors. CDN import loads the real untouched ESM build.
 */
import type { SubtitleLine } from '../types/index';

type WhisperChunk = { timestamp: [number, number | null]; text: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PipelineFn = (input: Float32Array, opts: object) => Promise<{ chunks?: WhisperChunk[] }>;

let currentModel = '';
let transcriber: PipelineFn | null = null;

async function getTranscriber(model: string): Promise<PipelineFn> {
  if (transcriber && currentModel === model) return transcriber;
  transcriber  = null;
  currentModel = model;

  // Load directly from CDN — untouched by Vite, works in module workers
  const { pipeline, env } = await import(
    /* @vite-ignore */
    'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/src/transformers.js'
  );

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
  ) as PipelineFn;

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

    const pipe = await getTranscriber(model ?? 'Xenova/whisper-small');
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
