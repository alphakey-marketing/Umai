/**
 * Web Worker: Transformers.js Whisper pipeline (off main thread).
 *
 * Message IN:  { type: 'transcribe', audioData: Float32Array, sampleRate: number, model: string }
 * Message OUT: { type: 'progress', data } | { type: 'result', lines } | { type: 'error', message }
 */

import { pipeline, env } from '@xenova/transformers';
import type { SubtitleLine } from '../types/index';

env.allowLocalModels = false;
env.useBrowserCache  = true;

type WhisperChunk = { timestamp: [number, number | null]; text: string };

let currentModel = '';
let transcriber: Awaited<ReturnType<typeof pipeline>> | null = null;

async function getTranscriber(model: string) {
  if (transcriber && currentModel === model) return transcriber;
  transcriber  = null;
  currentModel = model;
  transcriber  = await pipeline(
    'automatic-speech-recognition',
    model,
    {
      progress_callback: (data: { status: string; name?: string; progress?: number }) => {
        self.postMessage({ type: 'progress', data });
      },
    }
  );
  return transcriber;
}

self.onmessage = async (event: MessageEvent) => {
  const { type, audioData, sampleRate, model } = event.data as {
    type: string; audioData: Float32Array; sampleRate: number; model: string;
  };
  if (type !== 'transcribe') return;
  try {
    const pipe  = await getTranscriber(model ?? 'Xenova/whisper-small');
    const audio = sampleRate === 16000 ? audioData : resampleTo16k(audioData, sampleRate);
    const output = await pipe(audio, {
      language: 'japanese', task: 'transcribe',
      return_timestamps: 'word', chunk_length_s: 30, stride_length_s: 5,
    }) as { chunks?: WhisperChunk[]; text?: string };
    const lines = chunksToSubtitleLines(output.chunks ?? []);
    self.postMessage({ type: 'result', lines });
  } catch (err) {
    self.postMessage({ type: 'error', message: (err as Error).message });
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

function resampleTo16k(input: Float32Array, srcRate: number): Float32Array {
  const ratio = srcRate / 16000;
  const out   = new Float32Array(Math.round(input.length / ratio));
  for (let i = 0; i < out.length; i++) out[i] = input[Math.min(Math.round(i * ratio), input.length - 1)];
  return out;
}
