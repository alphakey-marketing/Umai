/**
 * Whisper API client — Phase 2B.
 *
 * Sends an audio blob to OpenAI Whisper and returns SubtitleLine[].
 * Requires VITE_OPENAI_API_KEY in .env
 *
 * Usage:
 *   const lines = await transcribeWithWhisper(audioBlob, 'ja');
 */

import { parseSRT } from './subtitleParser';
import type { SubtitleLine } from '../types';

const WHISPER_URL = 'https://api.openai.com/v1/audio/transcriptions';

export function isWhisperAvailable(): boolean {
  return !!import.meta.env.VITE_OPENAI_API_KEY;
}

/**
 * Transcribe an audio blob using OpenAI Whisper.
 * Returns SubtitleLine[] with timestamps.
 *
 * @param audioBlob  - Audio file as Blob (mp3, mp4, wav, webm etc.)
 * @param language   - ISO 639-1 language code, default 'ja'
 */
export async function transcribeWithWhisper(
  audioBlob: Blob,
  language = 'ja'
): Promise<SubtitleLine[]> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) throw new Error('VITE_OPENAI_API_KEY is not set.');

  const form = new FormData();
  form.append('file', audioBlob, 'audio.webm');
  form.append('model', 'whisper-1');
  form.append('language', language);
  form.append('response_format', 'srt');  // request SRT directly

  const res = await fetch(WHISPER_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Whisper API error ${res.status}: ${err}`);
  }

  const srtText = await res.text();
  return parseSRT(srtText);
}

/**
 * Extract audio from a <video> element and transcribe.
 * Uses MediaRecorder to capture what is playing.
 *
 * NOTE: This records from the video element directly —
 * the video must be on the same origin or CORS-enabled.
 */
export async function transcribeVideoElement(
  videoEl: HTMLVideoElement,
  durationMs = 30_000
): Promise<SubtitleLine[]> {
  const stream = (videoEl as HTMLVideoElement & { captureStream(): MediaStream }).captureStream();
  const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
  const chunks: Blob[] = [];

  return new Promise((resolve, reject) => {
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = async () => {
      try {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const lines = await transcribeWithWhisper(blob);
        resolve(lines);
      } catch (e) { reject(e); }
    };
    recorder.onerror = reject;
    recorder.start();
    setTimeout(() => recorder.stop(), durationMs);
  });
}
