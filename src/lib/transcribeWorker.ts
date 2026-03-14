/**
 * transcribeWorker.ts
 *
 * Runs as a Web Worker (type:module). Loads @xenova/transformers at
 * runtime via importScripts so the library's BigInt literals are never
 * processed by Vite/esbuild during the production build.
 *
 * Message IN:
 *   { type: 'load',       model: string }
 *   { type: 'transcribe', audioData: Float32Array,
 *     chunkIndex: number, totalChunks: number, offsetSec: number }
 *
 * Message OUT:
 *   { type: 'progress',    data }                              — model download
 *   { type: 'ready' }                                          — model loaded
 *   { type: 'chunkResult', lines, chunkIndex, totalChunks }    — one chunk done
 *   { type: 'error',       message }
 */
import type { SubtitleLine } from '../types/index';

// ---------------------------------------------------------------------------
// Ambient types so tsc compiles without resolving the CDN module
// ---------------------------------------------------------------------------
declare function importScripts(...urls: string[]): void;

declare const transformers: {
  pipeline: (task: string, model: string, opts: object) => Promise<PipelineFn>;
  env: { allowLocalModels: boolean; useBrowserCache: boolean };
};

type WordToken = {
  text: string;
  timestamp: [number, number | null];
};

type PipelineFn = (input: Float32Array, opts: object) => Promise<{ chunks?: WordToken[] }>;

const CDN_URL =
  'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js';

let transformersLoaded = false;

function ensureTransformers(): void {
  if (transformersLoaded) return;
  // importScripts loads the UMD bundle synchronously into the worker scope.
  // The bundle exposes a global `transformers` object.
  importScripts(CDN_URL);
  transformersLoaded = true;
}

let currentModel = '';
let transcriber: PipelineFn | null = null;

async function getTranscriber(model: string): Promise<PipelineFn> {
  if (transcriber && currentModel === model) return transcriber;
  transcriber  = null;
  currentModel = model;

  ensureTransformers();

  // Access globals injected by the UMD bundle
  const { pipeline, env } = (self as unknown as { transformers: typeof transformers }).transformers;

  env.allowLocalModels = false;
  env.useBrowserCache  = true;

  transcriber = await pipeline(
    'automatic-speech-recognition',
    model,
    { progress_callback: (data: unknown) => self.postMessage({ type: 'progress', data }) }
  ) as unknown as PipelineFn;
  return transcriber!;
}

self.onmessage = async (event: MessageEvent) => {
  const msg = event.data as {
    type: string;
    model?: string;
    audioData?: Float32Array;
    chunkIndex?: number;
    totalChunks?: number;
    offsetSec?: number;
  };

  if (msg.type === 'load') {
    try {
      await getTranscriber(msg.model ?? 'Xenova/whisper-tiny');
      self.postMessage({ type: 'ready' });
    } catch (err) {
      self.postMessage({ type: 'error', message: String((err as Error)?.message ?? err) });
    }
    return;
  }

  if (msg.type === 'transcribe') {
    const { audioData, chunkIndex = 0, totalChunks = 1, model, offsetSec = 0 } = msg as {
      audioData: Float32Array; chunkIndex: number; totalChunks: number;
      model: string; offsetSec: number;
    };
    try {
      const pipe = await getTranscriber(model ?? 'Xenova/whisper-tiny');
      const output = await pipe(audioData, {
        language: 'japanese',
        task: 'transcribe',
        return_timestamps: 'word',
      }) as { chunks?: WordToken[] };

      const shifted: WordToken[] = (output.chunks ?? []).map(c => ({
        ...c,
        timestamp: [
          c.timestamp[0] + offsetSec,
          c.timestamp[1] != null ? c.timestamp[1] + offsetSec : null,
        ] as [number, number | null],
      }));

      const lines = wordsToSubtitleLines(shifted);
      self.postMessage({ type: 'chunkResult', lines, chunkIndex, totalChunks });
    } catch (err) {
      self.postMessage({ type: 'error', message: String((err as Error)?.message ?? err) });
    }
  }
};

function wordsToSubtitleLines(words: WordToken[]): SubtitleLine[] {
  const LONG_PAUSE     = 0.5;
  const SHORT_PAUSE    = 0.3;
  const MAX_DURATION_S = 8.0;
  const MAX_WORDS      = 15;
  const PUNCT          = /[。、！？!?,，]/;

  const lines: SubtitleLine[] = [];
  let buffer: WordToken[] = [];
  let lineIdx = 0;

  function flush() {
    if (!buffer.length) return;
    const start = buffer[0].timestamp[0];
    const end   = buffer[buffer.length - 1].timestamp[1]
                ?? buffer[buffer.length - 1].timestamp[0] + 0.5;
    const text  = buffer.map(w => w.text).join('').trim();
    if (text) {
      lines.push({
        index:    ++lineIdx,
        start_ms: Math.round(start * 1000),
        end_ms:   Math.round(end   * 1000),
        text,
      });
    }
    buffer = [];
  }

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const next = words[i + 1];
    buffer.push(word);

    const wordEnd     = word.timestamp[1] ?? word.timestamp[0] + 0.2;
    const gap         = next ? (next.timestamp[0] - wordEnd) : 999;
    const bufStart    = buffer[0].timestamp[0];
    const bufDuration = wordEnd - bufStart;

    const hasPunct   = PUNCT.test(word.text);
    const tooLong    = bufDuration  >= MAX_DURATION_S;
    const tooManyW   = buffer.length >= MAX_WORDS;
    const longPause  = gap          >= LONG_PAUSE;
    const shortPause = gap          >= SHORT_PAUSE && hasPunct;

    if (longPause || shortPause || tooLong || tooManyW) flush();
  }
  flush();
  return lines;
}
