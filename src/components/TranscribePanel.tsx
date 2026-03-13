/**
 * TranscribePanel — in-browser Whisper transcription UI with streaming support.
 * Calls onResult() after every chunk so the user can start shadowing immediately.
 */
import { useState, useCallback } from 'react';
import {
  transcribeVideoFile,
  onTranscribeProgress,
  type TranscribeProgressEvent,
} from '../lib/whisperClient';
import { useSettings } from '../lib/settingsContext';
import type { SubtitleLine } from '../types/index';

interface Props {
  videoFile: File | null;
  onResult: (lines: SubtitleLine[]) => void;
}

type Phase = 'idle' | 'decoding' | 'loading-model' | 'transcribing' | 'done' | 'error';

export default function TranscribePanel({ videoFile, onResult }: Props) {
  const { settings }              = useSettings();
  const [phase, setPhase]         = useState<Phase>('idle');
  const [progress, setProgress]   = useState(0);
  const [statusMsg, setStatus]    = useState('');
  const [subMsg, setSubMsg]       = useState('');
  const [error, setError]         = useState<string | null>(null);
  const [chunkIndex, setChunkIdx] = useState(0);
  const [totalChunks, setTotal]   = useState(0);
  const [streaming, setStreaming] = useState(false);

  const handleTranscribe = useCallback(async () => {
    if (!videoFile) return;
    setError(null);
    setPhase('decoding');
    setProgress(0);
    setChunkIdx(0);
    setTotal(0);
    setStreaming(false);
    setStatus('Decoding audio…');
    setSubMsg('Reading audio track from file');

    onTranscribeProgress((ev: TranscribeProgressEvent) => {
      if (ev.status === 'decoding') {
        setPhase('decoding');
        setStatus('Decoding audio…');
        setSubMsg('Reading audio track from file');
      } else if (ev.status === 'decoded') {
        setStatus('Audio ready ✓');
        setSubMsg('Loading Whisper model…');
      } else if (ev.status === 'initiate' || ev.status === 'download') {
        setPhase('loading-model');
        setProgress(0);
        setStatus('Downloading Whisper model…');
        setSubMsg(ev.file ? `File: ${ev.file}` : '~40 MB — cached after first download');
      } else if (ev.status === 'progress') {
        const pct = Math.round(ev.progress ?? 0);
        setPhase('loading-model');
        setProgress(pct);
        setStatus(`Downloading model — ${pct}%`);
        setSubMsg(ev.file ? `${ev.file}` : '');
      } else if (ev.status === 'done') {
        setSubMsg(ev.file ? `✓ ${ev.file}` : '✓ Loaded');
      } else if (ev.status === 'ready') {
        setPhase('transcribing');
        setProgress(0);
        setStatus('Transcribing…');
        setSubMsg('First subtitles arriving shortly…');
      } else if (ev.status === 'partial') {
        const ci = ev.chunkIndex ?? 0;
        const tc = ev.totalChunks ?? 0;
        setChunkIdx(ci);
        setTotal(tc);
        const pct = tc > 0 ? Math.round((ci / tc) * 100) : 0;
        setProgress(pct);
        setStatus('Transcribing…');
        setSubMsg(`Chunk ${ci} / ${tc} — subtitles updating`);
        // Stream partial lines to player immediately
        if (ev.partialLines && ev.partialLines.length > 0) {
          setStreaming(true);
          onResult(ev.partialLines);
        }
      }
    });

    try {
      const lines = await transcribeVideoFile(videoFile, settings.whisper_model);
      setPhase('done');
      setStatus(`Done — ${lines.length} subtitle lines`);
      setSubMsg('');
      setStreaming(false);
      onResult(lines); // final complete set
    } catch (e) {
      setPhase('error');
      setError((e as Error).message);
    }
  }, [videoFile, onResult, settings.whisper_model]);

  const modelLabel = settings.whisper_model.replace('Xenova/', '');

  if (phase === 'idle') {
    return (
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 space-y-3">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🧠</span>
          <div>
            <p className="font-bold text-sm">Auto-transcribe with Whisper</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Free, in-browser — using{' '}
              <span className="text-indigo-400 font-semibold">{modelLabel}</span>.{' '}
              <a href="/settings" className="text-gray-500 hover:text-indigo-400">(change)</a>
            </p>
          </div>
        </div>
        <button
          onClick={handleTranscribe}
          disabled={!videoFile}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-bold py-2.5 rounded-xl transition-colors"
        >
          ✨ Generate Subtitles ({modelLabel})
        </button>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="rounded-xl bg-red-950/30 border border-red-900 p-4 space-y-2">
        <p className="text-sm font-bold text-red-400">❌ Transcription failed</p>
        <p className="text-xs text-gray-400 break-words">{error}</p>
        <button onClick={() => { setPhase('idle'); setError(null); }}
          className="text-xs text-indigo-400 hover:underline">Try again</button>
      </div>
    );
  }

  if (phase === 'done') return null; // subtitle player takes full focus when done

  const barWidth   = phase === 'transcribing'  ? Math.max(progress, 2)
                   : phase === 'loading-model' ? Math.max(progress, 2)
                   : 30;
  const barAnimate = phase === 'decoding' || (phase === 'transcribing' && totalChunks === 0);
  const showCount  = phase === 'loading-model' || phase === 'transcribing';

  return (
    <div className="rounded-xl bg-gray-900/80 border border-gray-700 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-base animate-spin shrink-0">⏳</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-300 font-semibold">{statusMsg}</p>
          {subMsg && <p className="text-xs text-gray-500 truncate">{subMsg}</p>}
        </div>
        {showCount && (
          <span className="text-xs font-bold text-indigo-400 shrink-0">
            {phase === 'transcribing' && totalChunks > 0
              ? `${chunkIndex} / ${totalChunks}`
              : `${progress}%`}
          </span>
        )}
      </div>
      <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
        <div
          className={`bg-indigo-500 h-1.5 rounded-full transition-all duration-500 ${
            barAnimate ? 'animate-pulse' : ''
          }`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      {streaming && (
        <p className="text-xs text-indigo-400 font-semibold">
          ▶️ You can start shadowing! More subtitles loading…
        </p>
      )}
    </div>
  );
}
