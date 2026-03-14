/**
 * transcribeWorker.ts
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
import { pipeline, env } from '@xenova/transformers';

type WordToken = {
  text: string;
  timestamp: [number, number | null];
};

type PipelineFn = (input: Float32Array, opts: object) => Promise<{ chunks?: WordToken[] }>;

let currentModel = '';
let transcriber: PipelineFn | null = null;

async function getTranscriber(model: string): Promise<PipelineFn> {
  if (transcriber && currentModel === model) return transcriber;
  transcriber  = null;
  currentModel = model;

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

      // Shift timestamps by the chunk's start offset in the full audio
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

/**
 * Convert word-level tokens into subtitle lines using:
 * 1. Silence gaps  >= 0.5s  -> always break
 * 2. Silence gaps  >= 0.3s + punctuation -> break
 * 3. Line duration >= 8s    -> force break (too long to shadow)
 * 4. Word count    >= 15    -> force break (safety cap)
 * This produces natural sentence-length chunks aligned with actual pauses.
 */
function wordsToSubtitleLines(words: WordToken[]): SubtitleLine[] {
  const LONG_PAUSE     = 0.5;   // seconds — always split
  const SHORT_PAUSE    = 0.3;   // seconds — split on punctuation
  const MAX_DURATION_S = 8.0;   // seconds — force split
  const MAX_WORDS      = 15;    // words   — safety cap
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

    // Calculate gap to next word
    const wordEnd  = word.timestamp[1] ?? word.timestamp[0] + 0.2;
    const gap      = next ? (next.timestamp[0] - wordEnd) : 999;

    // Calculate current buffer duration
    const bufStart    = buffer[0].timestamp[0];
    const bufDuration = wordEnd - bufStart;

    const hasPunct   = PUNCT.test(word.text);
    const tooLong    = bufDuration  >= MAX_DURATION_S;
    const tooManyW   = buffer.length >= MAX_WORDS;
    const longPause  = gap          >= LONG_PAUSE;
    const shortPause = gap          >= SHORT_PAUSE && hasPunct;

    if (longPause || shortPause || tooLong || tooManyW) {
      flush();
    }
  }
  flush(); // remainder
  return lines;
}
