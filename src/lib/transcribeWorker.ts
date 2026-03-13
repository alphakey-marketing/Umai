/**
 * transcribeWorker.ts
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

async function decodeToMono16k(arrayBuffer: ArrayBuffer): Promise<Float32Array> {
  if (typeof OfflineAudioContext === 'undefined') {
    throw new Error('OfflineAudioContext is not available in this worker environment.');
  }

  // Decode once at native sample rate
  let decoded: AudioBuffer;
  try {
    const tmpCtx = new OfflineAudioContext(1, 44100, 44100);
    decoded = await tmpCtx.decodeAudioData(arrayBuffer.slice(0));
  } catch (e) {
    throw new Error(
      'Audio decode failed: ' + (e as Error).message +
      '. Your browser may not support decoding this video format in a worker. ' +
      'Try a .webm file instead of .mp4, or upload a separate .mp3/.wav audio file.'
    );
  }

  // Resample to 16 kHz using a second OfflineAudioContext
  const native       = decoded.sampleRate;
  const frames       = decoded.length;
  const targetRate   = 16000;
  const targetFrames = Math.ceil(frames * (targetRate / native));

  const offCtx = new OfflineAudioContext(1, targetFrames, targetRate);
  const src    = offCtx.createBufferSource();
  src.buffer   = decoded;          // reuse already-decoded buffer, no second decodeAudioData
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
    // Guard: check we actually received data
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      throw new Error('Received empty file data. Please try uploading the video again.');
    }

    self.postMessage({ type: 'progress', data: { status: 'decoding' } });
    const mono = await decodeToMono16k(arrayBuffer);
    self.postMessage({ type: 'progress', data: { status: 'decoded' } });

    const pipe = await getTranscriber(model ?? 'Xenova/whisper-small');
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
    self.postMessage({ type: 'error', message: String((err as Error).message ?? err) });
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
