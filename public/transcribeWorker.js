/**
 * public/transcribeWorker.js
 *
 * Classic Web Worker loaded via: new Worker('/transcribeWorker.js')
 *
 * Uses importScripts('/transformers.min.js') — served from the same origin
 * (copied from node_modules at build time by scripts/copy-transformers.js).
 * Same-origin scripts are never blocked by CSP worker-src restrictions.
 */

// Load the UMD bundle from our own origin — never blocked by CSP
importScripts('/transformers.min.js');

let currentModel = '';
let transcriber = null;

async function getTranscriber(model) {
  if (transcriber && currentModel === model) return transcriber;
  transcriber = null;
  currentModel = model;

  const { pipeline, env } = self.transformers;

  env.allowLocalModels = false;
  env.useBrowserCache  = true;

  transcriber = await pipeline(
    'automatic-speech-recognition',
    model,
    { progress_callback: (data) => self.postMessage({ type: 'progress', data }) }
  );
  return transcriber;
}

self.onmessage = async (event) => {
  const msg = event.data;

  if (msg.type === 'load') {
    try {
      await getTranscriber(msg.model ?? 'Xenova/whisper-tiny');
      self.postMessage({ type: 'ready' });
    } catch (err) {
      self.postMessage({ type: 'error', message: String(err?.message ?? err) });
    }
    return;
  }

  if (msg.type === 'transcribe') {
    const { audioData, chunkIndex = 0, totalChunks = 1, model, offsetSec = 0 } = msg;
    try {
      const pipe   = await getTranscriber(model ?? 'Xenova/whisper-tiny');
      const output = await pipe(audioData, {
        language:          'japanese',
        task:              'transcribe',
        return_timestamps: 'word',
      });

      const shifted = (output.chunks ?? []).map(c => ({
        ...c,
        timestamp: [
          c.timestamp[0] + offsetSec,
          c.timestamp[1] != null ? c.timestamp[1] + offsetSec : null,
        ],
      }));

      const lines = wordsToSubtitleLines(shifted);
      self.postMessage({ type: 'chunkResult', lines, chunkIndex, totalChunks });
    } catch (err) {
      self.postMessage({ type: 'error', message: String(err?.message ?? err) });
    }
  }
};

function wordsToSubtitleLines(words) {
  const LONG_PAUSE     = 0.5;
  const SHORT_PAUSE    = 0.3;
  const MAX_DURATION_S = 8.0;
  const MAX_WORDS      = 15;
  const PUNCT          = /[\u3002\u3001\uff01\uff1f!?,\uff0c]/;

  const lines  = [];
  let buffer   = [];
  let lineIdx  = 0;

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
