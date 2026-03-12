/**
 * Web Worker: runs Transformers.js Whisper pipeline off the main thread.
 * This keeps the UI responsive during model load + transcription.
 *
 * Message IN:  { type: 'transcribe', audioData: Float32Array, sampleRate: number }
 * Message OUT: { type: 'progress',   data: { status, name, progress } }
 *              { type: 'result',     lines: SubtitleLine[] }
 *              { type: 'error',      message: string }
 */

import { pipeline, env } from '@xenova/transformers';
import type { SubtitleLine } from '../types';

// Use CDN-hosted models — no local bundling needed
env.allowLocalModels  = false;
env.useBrowserCache   = true;   // cache model in browser IndexedDB after first download

type WhisperChunk = {
  timestamp: [number, number | null];
  text: string;
};

let transcriber: Awaited<ReturnType<typeof pipeline>> | null = null;

async function getTranscriber() {
  if (transcriber) return transcriber;

  transcriber = await pipeline(
    'automatic-speech-recognition',
    // whisper-small: ~240 MB first load, then cached. Good Japanese quality.
    // Swap to 'Xenova/whisper-medium' for better accuracy (~780 MB).
    'Xenova/whisper-small',
    {
      progress_callback: (data: { status: string; name?: string; progress?: number }) => {
        self.postMessage({ type: 'progress', data });
      },
    }
  );
  return transcriber;
}

self.onmessage = async (event: MessageEvent) => {
  const { type, audioData, sampleRate } = event.data as {
    type: string;
    audioData: Float32Array;
    sampleRate: number;
  };

  if (type !== 'transcribe') return;

  try {
    const pipe = await getTranscriber();

    // Resample to 16 kHz if needed (Whisper requires 16 kHz mono)
    const audio = sampleRate === 16000
      ? audioData
      : resampleTo16k(audioData, sampleRate);

    const output = await pipe(audio, {
      language:          'japanese',
      task:              'transcribe',
      return_timestamps: 'word',   // get word-level timestamps for sentence building
      chunk_length_s:    30,
      stride_length_s:   5,
    }) as { chunks?: WhisperChunk[]; text?: string };

    const lines = chunksToSubtitleLines(output.chunks ?? []);
    self.postMessage({ type: 'result', lines });
  } catch (err) {
    self.postMessage({ type: 'error', message: (err as Error).message });
  }
};

/** Convert Whisper chunks (word-level timestamps) into SubtitleLine[] */
function chunksToSubtitleLines(chunks: WhisperChunk[]): SubtitleLine[] {
  const lines: SubtitleLine[] = [];
  let buffer: WhisperChunk[]  = [];
  let lineIndex               = 0;

  function flush() {
    if (buffer.length === 0) return;
    const start = buffer[0].timestamp[0];
    const end   = buffer[buffer.length - 1].timestamp[1] ?? buffer[buffer.length - 1].timestamp[0] + 2;
    const text  = buffer.map(c => c.text).join('').trim();
    if (text) {
      lines.push({
        index:    ++lineIndex,
        start_ms: Math.round(start * 1000),
        end_ms:   Math.round(end   * 1000),
        text,
      });
    }
    buffer = [];
  }

  for (const chunk of chunks) {
    buffer.push(chunk);
    // Break on sentence-ending punctuation 。！？ or every ~10 words
    const text = chunk.text;
    if (/[。！？!?]/.test(text) || buffer.length >= 10) {
      flush();
    }
  }
  flush(); // flush any remaining
  return lines;
}

/** Linear resample Float32Array from srcRate → 16000 Hz */
function resampleTo16k(input: Float32Array, srcRate: number): Float32Array {
  const ratio      = srcRate / 16000;
  const outputLen  = Math.round(input.length / ratio);
  const output     = new Float32Array(outputLen);
  for (let i = 0; i < outputLen; i++) {
    output[i] = input[Math.min(Math.round(i * ratio), input.length - 1)];
  }
  return output;
}
