/**
 * TranscribePanel — in-browser Whisper transcription UI.
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

type Phase = 'idle' | 'loading-model' | 'transcribing' | 'done' | 'error';

export default function TranscribePanel({ videoFile, onResult }: Props) {
  const { settings }            = useSettings();
  const [phase, setPhase]       = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatus]  = useState('');
  const [fileMsg, setFileMsg]   = useState('');
  const [error, setError]       = useState<string | null>(null);

  const handleTranscribe = useCallback(async () => {
    if (!videoFile) return;
    setError(null);
    setPhase('loading-model');
    setProgress(0);
    setFileMsg('');
    setStatus('Connecting to Whisper model…');

    onTranscribeProgress((ev: TranscribeProgressEvent) => {
      if (ev.status === 'initiate') {
        setPhase('loading-model');
        setStatus('Downloading Whisper model…');
        setFileMsg(ev.file ? `File: ${ev.file}` : '');
        setProgress(0);
      } else if (ev.status === 'download') {
        setStatus('Downloading Whisper model…');
        setFileMsg(ev.file ? `File: ${ev.file}` : '');
      } else if (ev.status === 'progress') {
        const pct = Math.round(ev.progress ?? 0);
        setProgress(pct);
        setStatus(`Downloading model — ${pct}%`);
        setFileMsg(ev.file ? `File: ${ev.file}` : '');
      } else if (ev.status === 'done') {
        setStatus(`Loaded ✓`);
        setFileMsg(ev.file ? `${ev.file} ready` : '');
      } else if (ev.status === 'ready') {
        setPhase('transcribing');
        setProgress(0);
        setFileMsg('');
        setStatus('Transcribing Japanese audio…');
      }
    });

    try {
      const lines = await transcribeVideoFile(videoFile, settings.whisper_model);
      setPhase('done');
      setStatus(`Done — ${lines.length} subtitle lines found`);
      onResult(lines);
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
        <button
          onClick={() => { setPhase('idle'); setError(null); }}
          className="text-xs text-indigo-400 hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="rounded-xl bg-green-950/30 border border-green-900 p-4 flex items-center gap-3">
        <span className="text-2xl">✅</span>
        <p className="text-sm text-green-400 font-bold">{statusMsg}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 space-y-3">
      {/* Status row */}
      <div className="flex items-center gap-3">
        <span className="text-xl animate-spin">⏳</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-200 font-semibold">{statusMsg}</p>
          {fileMsg ? <p className="text-xs text-gray-500 truncate mt-0.5">{fileMsg}</p> : null}
        </div>
        {phase === 'loading-model' && (
          <span className="text-sm font-bold text-indigo-400 shrink-0">{progress}%</span>
        )}
      </div>

      {/* Progress bar — always visible once started */}
      {phase === 'loading-model' ? (
        <div className="space-y-1">
          <div className="w-full bg-gray-800 rounded-full h-2.5">
            <div
              className="bg-indigo-500 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${Math.max(progress, 2)}%` }}
            />
          </div>
          <p className="text-xs text-gray-600">
            {progress === 0
              ? 'Starting download — ~244 MB for whisper-small (cached after first run)'
              : 'Cached after first download — future runs are instant'}
          </p>
        </div>
      ) : (
        <div className="w-full bg-gray-800 rounded-full h-2.5 overflow-hidden">
          <div className="bg-indigo-500 h-2.5 rounded-full animate-pulse w-2/3" />
        </div>
      )}
    </div>
  );
}
