/**
 * TranscribePanel — in-browser Whisper transcription.
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

type Phase = 'idle' | 'loading' | 'transcribing' | 'done' | 'error';

export default function TranscribePanel({ videoFile, onResult }: Props) {
  const { settings }            = useSettings();
  const [phase, setPhase]       = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatus]  = useState('');
  const [error, setError]       = useState<string | null>(null);

  const handleTranscribe = useCallback(async () => {
    if (!videoFile) return;
    setError(null);
    setPhase('loading');
    setProgress(0);
    setStatus('Loading Whisper model…');

    onTranscribeProgress((ev: TranscribeProgressEvent) => {
      if (ev.status === 'initiate' || ev.status === 'download') {
        setStatus('Downloading Whisper model…');
        setProgress(0);
      } else if (ev.status === 'progress') {
        setProgress(Math.round(ev.progress ?? 0));
        setStatus(`Downloading model — ${Math.round(ev.progress ?? 0)}%`);
      } else if (ev.status === 'done') {
        setStatus('Model loaded ✓');
      } else if (ev.status === 'ready') {
        setPhase('transcribing');
        setProgress(0);
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

  const showBar = phase === 'loading' && progress > 0;

  return (
    <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-xl animate-spin">⏳</span>
        <p className="text-sm text-gray-300">{statusMsg}</p>
      </div>
      {showBar ? (
        <div className="space-y-1">
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div
              className="bg-indigo-500 h-2 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 text-right">{progress}%</p>
        </div>
      ) : (
        <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
          <div className="bg-indigo-500 h-2 rounded-full animate-pulse w-1/2" />
        </div>
      )}
    </div>
  );
}
