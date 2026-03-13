/**
 * TranscribePanel — debug version shows every progress event as a log line
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

export default function TranscribePanel({ videoFile, onResult }: Props) {
  const { settings }          = useSettings();
  const [log, setLog]         = useState<string[]>([]);
  const [done, setDone]       = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const addLog = (msg: string) => setLog(prev => [...prev, msg]);

  const handleTranscribe = useCallback(async () => {
    if (!videoFile) return;
    setLog([]);
    setDone(false);
    setError(null);
    setRunning(true);
    addLog(`▶ Started — file: ${videoFile.name} (${(videoFile.size / 1024 / 1024).toFixed(1)} MB)`);

    onTranscribeProgress((ev: TranscribeProgressEvent & { progress?: number }) => {
      const pct = ev.progress != null ? ` — ${Math.round(ev.progress)}%` : '';
      const file = (ev as any).file ? ` [${(ev as any).file}]` : '';
      addLog(`ℹ️ ${ev.status}${pct}${file}`);
    });

    try {
      const lines = await transcribeVideoFile(videoFile, settings.whisper_model);
      setDone(true);
      setRunning(false);
      addLog(`✅ Done — ${lines.length} lines`);
      onResult(lines);
    } catch (e) {
      setError((e as Error).message);
      setRunning(false);
      addLog(`❌ Error: ${(e as Error).message}`);
    }
  }, [videoFile, onResult, settings.whisper_model]);

  const modelLabel = settings.whisper_model.replace('Xenova/', '');

  return (
    <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <span className="text-2xl">🧠</span>
        <div>
          <p className="font-bold text-sm">Auto-transcribe with Whisper ({modelLabel})</p>
          <p className="text-xs text-gray-500">Debug mode — shows every step</p>
        </div>
      </div>

      {!running && !done && (
        <button
          onClick={handleTranscribe}
          disabled={!videoFile}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-bold py-2.5 rounded-xl"
        >
          ✨ Generate Subtitles
        </button>
      )}

      {log.length > 0 && (
        <div className="bg-black rounded-lg p-3 space-y-1 max-h-64 overflow-y-auto font-mono text-xs">
          {log.map((line, i) => (
            <div key={i} className={
              line.startsWith('❌') ? 'text-red-400' :
              line.startsWith('✅') ? 'text-green-400' :
              'text-gray-300'
            }>{line}</div>
          ))}
          {running && <div className="text-indigo-400 animate-pulse">working…</div>}
        </div>
      )}

      {error && (
        <div className="bg-red-950/40 border border-red-900 rounded-lg p-3">
          <p className="text-xs text-red-400 font-bold">❌ {error}</p>
          <button
            onClick={() => { setError(null); setLog([]); setRunning(false); }}
            className="text-xs text-indigo-400 hover:underline mt-1"
          >Try again</button>
        </div>
      )}
    </div>
  );
}
