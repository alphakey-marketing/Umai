/**
 * whisperClient.ts — In-browser transcription via Transformers.js Web Worker.
 *
 * Audio extraction strategy:
 * - Hidden muted <video> + ScriptProcessorNode to capture PCM in real time
 * - AudioContext.resume() called explicitly before play() — browsers suspend
 *   AudioContext automatically when not created in a direct user gesture frame
 * - 4× playback speed to reduce extraction time
 * - Resampled to 16 kHz for Whisper
 */
import type { SubtitleLine } from '../types/index';

export type TranscribeProgressEvent = {
  status: 'initiate' | 'download' | 'progress' | 'done' | 'ready' | 'extracting';
  name?: string;
  progress?: number;
  file?: string;
};

type ProgressCallback = (event: TranscribeProgressEvent) => void;

let worker: Worker | null = null;
let progressCb: ProgressCallback | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./transcribeWorker.ts', import.meta.url), { type: 'module' });
  }
  return worker;
}

export function onTranscribeProgress(cb: ProgressCallback): void {
  progressCb = cb;
}

/** Send already-decoded AudioBuffer to the Whisper worker. */
export function transcribeAudioBuffer(
  audioBuffer: AudioBuffer,
  model = 'Xenova/whisper-small'
): Promise<SubtitleLine[]> {
  return new Promise((resolve, reject) => {
    const w           = getWorker();
    const numChannels = audioBuffer.numberOfChannels;
    const length      = audioBuffer.length;
    const mono        = new Float32Array(length);
    for (let ch = 0; ch < numChannels; ch++) {
      const channel = audioBuffer.getChannelData(ch);
      for (let i = 0; i < length; i++) mono[i] += channel[i] / numChannels;
    }
    function onMessage(e: MessageEvent) {
      const { type, lines, data, message } = e.data;
      if      (type === 'progress' && data && progressCb) progressCb(data);
      else if (type === 'result' && lines) { w.removeEventListener('message', onMessage); resolve(lines); }
      else if (type === 'error')           { w.removeEventListener('message', onMessage); reject(new Error(message ?? 'Transcription failed')); }
    }
    w.addEventListener('message', onMessage);
    w.postMessage({ type: 'transcribe', audioData: mono, sampleRate: audioBuffer.sampleRate, model }, [mono.buffer]);
  });
}

/**
 * Extract PCM from a video File using a hidden muted <video> +
 * ScriptProcessorNode. Explicitly resumes AudioContext before playback
 * because browsers auto-suspend it when created outside a user-gesture frame.
 */
function extractPCMFromVideo(
  file: File,
  onProgress?: (pct: number) => void
): Promise<{ pcm: Float32Array; sampleRate: number }> {
  return new Promise((resolve, reject) => {
    const CAPTURE_RATE = 44100;
    const TARGET_RATE  = 16000;
    const objectURL    = URL.createObjectURL(file);

    const video         = document.createElement('video');
    video.src           = objectURL;
    video.muted         = true;
    video.playbackRate  = 4.0;
    video.style.cssText =
      'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;top:-9999px;left:-9999px';
    document.body.appendChild(video);

    function cleanup() {
      try { video.pause(); }                    catch { /* ignore */ }
      try { document.body.removeChild(video); } catch { /* ignore */ }
      URL.revokeObjectURL(objectURL);
    }

    video.onerror = () => {
      cleanup();
      reject(new Error('Could not load video file. Make sure it is a valid mp4, webm, or mkv.'));
    };

    video.onloadedmetadata = async () => {
      const duration = video.duration;
      if (!isFinite(duration) || duration <= 0) {
        cleanup();
        reject(new Error('Could not read video duration.'));
        return;
      }

      let audioCtx: AudioContext;
      try {
        audioCtx = new AudioContext({ sampleRate: CAPTURE_RATE });
      } catch (e) {
        cleanup();
        reject(new Error('AudioContext unavailable: ' + (e as Error).message));
        return;
      }

      // CRITICAL: resume AudioContext — browsers auto-suspend it when not
      // created synchronously inside a user gesture handler.
      if (audioCtx.state === 'suspended') {
        try { await audioCtx.resume(); } catch { /* proceed anyway */ }
      }

      const source    = audioCtx.createMediaElementSource(video);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      const collected: Float32Array[] = [];

      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        collected.push(new Float32Array(e.inputBuffer.getChannelData(0)));
        const pct = Math.min(99, Math.round((video.currentTime / duration) * 100));
        onProgress?.(pct);
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);

      video.onended = () => {
        processor.disconnect();
        source.disconnect();
        audioCtx.close();
        cleanup();
        onProgress?.(100);

        if (collected.length === 0) {
          reject(new Error(
            'Audio capture returned no data. ' +
            'Your browser may have blocked AudioContext — try opening the app in a full browser tab (not the Replit preview iframe).'
          ));
          return;
        }

        const totalLen = collected.reduce((s, c) => s + c.length, 0);
        const full     = new Float32Array(totalLen);
        let off = 0;
        for (const chunk of collected) { full.set(chunk, off); off += chunk.length; }
        resolve({ pcm: resample(full, CAPTURE_RATE, TARGET_RATE), sampleRate: TARGET_RATE });
      };

      try {
        await video.play();
      } catch (err) {
        processor.disconnect();
        source.disconnect();
        audioCtx.close();
        cleanup();
        reject(new Error('video.play() failed: ' + (err as Error).message));
      }
    };
  });
}

/** Linear interpolation resample */
function resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input;
  const ratio  = fromRate / toRate;
  const length = Math.round(input.length / ratio);
  const output = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const pos = i * ratio;
    const idx = Math.floor(pos);
    const f   = pos - idx;
    output[i] = (input[idx] ?? 0) + f * ((input[idx + 1] ?? 0) - (input[idx] ?? 0));
  }
  return output;
}

/** Main entry point: extract audio from video file, then transcribe. */
export async function transcribeVideoFile(
  file: File,
  model = 'Xenova/whisper-small'
): Promise<SubtitleLine[]> {
  progressCb?.({ status: 'extracting', progress: 0 });

  const { pcm, sampleRate } = await extractPCMFromVideo(file, (pct) => {
    progressCb?.({ status: 'extracting', progress: pct });
  });

  return new Promise((resolve, reject) => {
    const w    = getWorker();
    const mono = pcm.slice();
    function onMessage(e: MessageEvent) {
      const { type, lines, data, message } = e.data;
      if      (type === 'progress' && data && progressCb) progressCb(data);
      else if (type === 'result' && lines) { w.removeEventListener('message', onMessage); resolve(lines); }
      else if (type === 'error')           { w.removeEventListener('message', onMessage); reject(new Error(message ?? 'Transcription failed')); }
    }
    w.addEventListener('message', onMessage);
    w.postMessage({ type: 'transcribe', audioData: mono, sampleRate, model }, [mono.buffer]);
  });
}

export function destroyWorker(): void {
  worker?.terminate();
  worker = null;
}
