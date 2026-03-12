import { useRef, useState, useCallback } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import VideoPlayer from '../components/VideoPlayer';
import SubtitlePlayer from '../components/SubtitlePlayer';
import { transcribeWithWhisper, isWhisperAvailable } from '../lib/whisperClient';
import { saveShadowSession, recordTodayActivity } from '../lib/shadowStorage';
import type {
  AnimeTitle,
  AnimeEpisode,
  ShadowingMode,
  SubtitleLine,
  ShadowingSession,
  VaultEntry,
} from '../types';

interface LocationState {
  anime: AnimeTitle;
  episode: AnimeEpisode;
  mode: ShadowingMode;
  subtitleLines: SubtitleLine[];
  videoObjectURL: string;
}

export default function SessionRunPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const state     = location.state as LocationState | null;

  const videoRef          = useRef<HTMLVideoElement>(null);
  const [currentMs, setCurrentMs]         = useState(0);
  const [lines, setLines]                 = useState<SubtitleLine[]>(state?.subtitleLines ?? []);
  const [savedCount, setSavedCount]       = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [transcribing, setTranscribing]   = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const sessionStartRef                   = useRef(new Date().toISOString());

  // Guard: no state = user navigated directly
  if (!state?.anime) {
    return (
      <div className="text-center py-20 space-y-4">
        <p className="text-5xl">🎬</p>
        <p className="font-bold">No session loaded.</p>
        <Link to="/session" className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-lg">
          Set up a session
        </Link>
      </div>
    );
  }

  const { anime, episode, mode, videoObjectURL } = state;

  // Auto-transcribe with Whisper if no SRT was uploaded
  async function handleWhisperTranscribe() {
    if (!videoRef.current) return;
    setTranscribing(true);
    setTranscribeError(null);
    try {
      // Capture 60 seconds from current position for demo
      const stream = (videoRef.current as HTMLVideoElement & { captureStream(): MediaStream }).captureStream();
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      const chunks: Blob[] = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      await new Promise<void>(resolve => {
        recorder.onstop = () => resolve();
        recorder.start();
        setTimeout(() => recorder.stop(), 30_000);
      });
      const blob  = new Blob(chunks, { type: 'audio/webm' });
      const result = await transcribeWithWhisper(blob, 'ja');
      setLines(result);
    } catch (e) {
      setTranscribeError((e as Error).message);
    } finally {
      setTranscribing(false);
    }
  }

  const handleSentenceComplete = useCallback((line: SubtitleLine) => {
    setCompletedCount(c => c + 1);
    void line; // suppress unused warning
  }, []);

  const handleSaved = useCallback((_entry: VaultEntry) => {
    setSavedCount(c => c + 1);
  }, []);

  function handleEnd() {
    const now     = new Date().toISOString();
    const startMs = new Date(sessionStartRef.current).getTime();
    const endMs   = new Date(now).getTime();
    const minutes = Math.round((endMs - startMs) / 60000);

    const session: ShadowingSession = {
      id:                   `shadow_${Date.now()}`,
      user_id:              'guest',
      anime_id:             anime.id,
      anime_title:          anime.title,
      episode_id:           episode?.id ?? '',
      episode_number:       episode?.episode_number ?? 1,
      mode,
      started_at:           sessionStartRef.current,
      ended_at:             now,
      sentences_total:      lines.length,
      sentences_completed:  completedCount,
      sentences_saved:      savedCount,
      self_rating:          null,
    };
    saveShadowSession(session);
    recordTodayActivity(completedCount, minutes);

    navigate('/session/feedback', { state: { session, savedCount, completedCount } });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="flex items-center gap-3">
        <span className="text-2xl">{anime.cover_emoji}</span>
        <div className="flex-1 min-w-0">
          <h1 className="font-black text-base truncate">{anime.title}</h1>
          <p className="text-xs text-gray-400">Ep. {episode?.episode_number ?? 1} · {mode} mode</p>
        </div>
        <button
          onClick={handleEnd}
          className="text-xs font-bold bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 px-3 py-1.5 rounded-full transition-colors"
        >
          End ✓
        </button>
      </header>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <MiniStat value={lines.length}      label="Lines" />
        <MiniStat value={completedCount}    label="Shadowed" />
        <MiniStat value={savedCount}        label="Saved" />
      </div>

      {/* Video player */}
      <VideoPlayer
        ref={videoRef}
        src={videoObjectURL}
        onTimeUpdate={setCurrentMs}
        onEnded={handleEnd}
      />

      {/* Whisper transcribe button (shown only when no SRT loaded) */}
      {lines.length === 0 && isWhisperAvailable() && (
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 text-center space-y-2">
          <p className="text-sm text-gray-400">No subtitle file loaded.</p>
          <button
            onClick={handleWhisperTranscribe}
            disabled={transcribing}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors"
          >
            {transcribing ? '⏳ Transcribing…' : '✨ Transcribe with Whisper'}
          </button>
          {transcribeError && <p className="text-xs text-red-400">{transcribeError}</p>}
        </div>
      )}

      {lines.length === 0 && !isWhisperAvailable() && (
        <div className="rounded-xl bg-gray-900 border border-yellow-900/50 p-4 text-sm text-yellow-300 space-y-1">
          <p className="font-bold">⚠️ No subtitles loaded</p>
          <p className="text-xs text-gray-400">Upload a .srt file on the setup page, or add VITE_OPENAI_API_KEY to enable Whisper.</p>
        </div>
      )}

      {/* Subtitle player */}
      {lines.length > 0 && (
        <SubtitlePlayer
          lines={lines}
          currentMs={currentMs}
          animeId={anime.id}
          animeName={anime.title}
          episodeNumber={episode?.episode_number ?? 1}
          videoRef={videoRef}
          mode={mode}
          onSentenceComplete={handleSentenceComplete}
          onSaved={handleSaved}
        />
      )}

      {/* Keyboard shortcuts cheatsheet */}
      <div className="rounded-xl bg-gray-900/50 border border-gray-800 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-2">Keyboard Shortcuts</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500">
          {([
            ['Space', 'Play / Pause'],
            ['R', 'Replay current line'],
            ['H', 'Hide / show subtitle'],
            ['S', 'Save line to vault'],
            ['← / →', 'Seek ±5 seconds'],
          ] as const).map(([key, desc]) => (
            <div key={key} className="flex gap-2">
              <kbd className="bg-gray-800 border border-gray-700 rounded px-1 font-mono">{key}</kbd>
              <span>{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MiniStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl bg-gray-800 py-2">
      <p className="text-xl font-black">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
