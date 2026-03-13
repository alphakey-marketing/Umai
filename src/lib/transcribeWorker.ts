/**
 * transcribeWorker.ts — Transformers.js Whisper pipeline, fully off main thread.
 *
 * Messages IN:
 *   { type: 'transcribe', arrayBuffer: ArrayBuffer, model: string }
 *
 * Messages OUT:
 *   { type: 'progress', data }          — model download / decode progress
 *   { type: 'result',   lines }         — final SubtitleLine[]
 *   { type: 'error',    message }       — any failure
 *
 * Audio decode strategy:
 *   OfflineAudioContext.decodeAudioData() works fine in a Worker — no user
 *   gesture required, no conflicts with any visible media element.
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
      progress_callback: (data: unknown) => {
        self.postMessage({ type: 'progress', data });
      },
    }
  );
  return transcriber;
}

/** Decode ArrayBuffer → mono Float32Array at 16 kHz using OfflineAudioContext */
async function decodeToMono16k(arrayBuffer: ArrayBuffer): Promise<Float32Array> {
  // First pass: decode at native rate to find sample count / rate
  const tmpCtx    = new OfflineAudioContext(1, 1, 44100);
  const tmpBuffer = await tmpCtx.decodeAudioData(arrayBuffer.slice(0));
  const native    = tmpBuffer.sampleRate;
  const frames    = tmpBuffer.length;

  // Second pass: decode + resample to 16 kHz in one shot
  const targetRate   = 16000;
  const targetFrames = Math.ceil(frames * (targetRate / native));
  const offCtx       = new OfflineAudioContext(1, targetFrames, targetRate);
  const src          = offCtx.createBufferSource();
  src.buffer         = await offCtx.decodeAudioData(arrayBuffer.slice(0));
  src.connect(offCtx.destination);
  src.start(0);
  const rendered = await offCtx.startRendering();
  return rendered.getChannelData(0);
}

self.onmessage = async (event: MessageEvent) => {
  const { type, arrayBuffer, model } = event.data as {
    type: string;
    arrayBuffer: ArrayBuffer;
    model: string;
  };

  if (type !== 'transcribe') return;

  try {
    // Step 1: decode audio
    self.postMessage({ type: 'progress', data: { status: 'decoding' } });
    const mono = await decodeToMono16k(arrayBuffer);
    self.postMessage({ type: 'progress', data: { status: 'decoded' } });

    // Step 2: load / reuse Whisper pipeline (triggers model download progress)
    const pipe = await getTranscriber(model ?? 'Xenova/whisper-small');

    // Step 3: transcribe
    self.postMessage({ type: 'progress', data: { status: 'ready' } });
    const output = await pipe(mono, {
      language: 'japanese',
      task: 'transcribe',
      return_timestamps: 'word',
      chunk_length_s: 30,
      stride_length_s: 5,
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
    const end   = buffer[buffer.length - 1].timestamp[1]
      ?? buffer[buffer.length - 1].timestamp[0] + 2;
    const text  = buffer.map(c => c.text).join('').trim();
    if (text) lines.push({
      index:    ++idx,
      start_ms: Math.round(start * 1000),
      end_ms:   Math.round(end   * 1000),
      text,
    });
    buffer = [];
  }

  for (const chunk of chunks) {
    buffer.push(chunk);
    if (/[。！？!?]/.test(chunk.text) || buffer.length >= 10) flush();
  }
  flush();
  return lines;
}
