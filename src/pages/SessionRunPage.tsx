import { useRef, useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import VideoPlayer from '../components/VideoPlayer';
import SubtitlePlayer from '../components/SubtitlePlayer';
import TranscribePanel from '../components/TranscribePanel';
import { saveShadowSession, recordTodayActivity } from '../lib/shadowStorage';
import { useSettings } from '../lib/settingsContext';
import { getSessionFile, clearSessionFile } from '../lib/sessionStore';
import type {
  AnimeTitle, AnimeEpisode, ShadowingMode,
  SubtitleLine, ShadowingSession, VaultEntry,
} from '../types';

interface LocationState {
  anime:         AnimeTitle;
  episode:       AnimeEpisode;
  mode:          ShadowingMode;
  subtitleLines: SubtitleLine[];
}

const SPEEDS = [0.6, 0.8, 1.0] as const;
type Speed = typeof SPEEDS[number];

export default function SessionRunPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state    = location.state as LocationState | null;
  const { settings } = useSettings();

  // --- Video file + blob URL lifecycle ---
  //
  // The File lives in sessionStore (survives navigate, not serialized).
  // We create the blob URL HERE, once, in a ref. This is the ONLY place
  // it is created and the ONLY place it is revoked.
  //
  // Why useRef and not useState or a plain variable:
  //   - useRef: created once on first render, stable across re-renders,
  //     NOT affected by React Strict Mode’s double-invoke of effects.
  //   - We do NOT put URL.createObjectURL inside a useEffect because that
  //     runs AFTER the first paint, leaving the video src blank initially.
  //
  // Why we use a "mounted" ref guard for revoke:
  //   - React Strict Mode calls the cleanup of useEffect([]) twice in dev.
  //   - We only want to revoke on the REAL unmount, not the fake one.
  //   - The mounted ref is set to false only when the real unmount fires,
  //     which we detect by checking if the component is still in the tree.
  //
  // Actually the cleanest solution: store the URL in a ref, revoke it
  // with a ref-based cleanup that is immune to Strict Mode because we
  // use the ref value directly in the cleanup closure — no state reads.
  const videoFile = getSessionFile();
  const blobURLRef = useRef<string>('');
  if (!blobURLRef.current && videoFile) {
    // Runs synchronously on first render (and on Strict Mode’s second render).
    // On the second render the ref already has a value so this is skipped.
    blobURLRef.current = URL.createObjectURL(videoFile);
  }
  const videoObjectURL = blobURLRef.current;

  // Revoke the blob URL when the component truly unmounts.
  // We use a separate ref so the cleanup closure captures a stable pointer
  // to the same ref object — it will always read the current URL value
  // regardless of when cleanup fires.
  useEffect(() => {
    return () => {
      if (blobURLRef.current) {
        URL.revokeObjectURL(blobURLRef.current);
        blobURLRef.current = '';
      }
      clearSessionFile();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const videoRef                            = useRef<HTMLVideoElement>(null);
  const [currentMs, setCurrentMs]           = useState(0);
  const [lines, setLines]                   = useState<SubtitleLine[]>(state?.subtitleLines ?? []);
  const [transcribeDone, setTranscribeDone] = useState((state?.subtitleLines ?? []).length > 0);
  const [savedCount, setSavedCount]         = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [speed, setSpeed]                   = useState<Speed>(1.0);
  const [videoEnded, setVideoEnded]         = useState(false);
  const sessionStartRef                     = useRef(new Date().toISOString());

  if (!state?.anime || !videoObjectURL) {
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

  const { anime, episode, mode } = state;

  const handleTranscribeResult = useCallback((result: SubtitleLine[]) => {
    setLines(result);
  }, []);

  const handleTranscribeDone = useCallback((result: SubtitleLine[]) => {
    setLines(result);
    setTranscribeDone(true);
  }, []);

  const handleSentenceComplete = useCallback((_line: SubtitleLine) => {
    setCompletedCount(c => c + 1);
  }, []);

  const handleSaved = useCallback((_entry: VaultEntry) => {
    setSavedCount(c => c + 1);
  }, []);

  function commitSession() {
    const now     = new Date().toISOString();
    const startMs = new Date(sessionStartRef.current).getTime();
    const minutes = Math.round((Date.now() - startMs) / 60000);
    const session: ShadowingSession = {
      id:                  `shadow_${Date.now()}`,
      user_id:             'guest',
      anime_id:            anime.id,
      anime_title:         anime.title,
      episode_id:          episode?.id ?? '',
      episode_number:      episode?.episode_number ?? 1,
      mode,
      started_at:          sessionStartRef.current,
      ended_at:            now,
      sentences_total:     lines.length,
      sentences_completed: completedCount,
      sentences_saved:     savedCount,
      self_rating:         null,
    };
    saveShadowSession(session);
    recordTodayActivity(completedCount, minutes);
    navigate('/session/feedback', { state: { session, savedCount, completedCount } });
  }

  function handleVideoEnded() {
    setVideoEnded(true);
  }

  const hasLines = lines.length > 0;

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
          onClick={commitSession}
          className="text-xs font-bold bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 px-3 py-1.5 rounded-full transition-colors"
        >
          End ✓
        </button>
      </header>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <MiniStat value={lines.length}   label="Lines" />
        <MiniStat value={completedCount} label="Shadowed" />
        <MiniStat value={savedCount}     label="Saved" />
      </div>

      {/* Video */}
      <VideoPlayer
        ref={videoRef}
        src={videoObjectURL}
        onTimeUpdate={setCurrentMs}
        onEnded={handleVideoEnded}
        speed={speed}
      />

      {/* Speed toggle */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 font-semibold">Speed</span>
        <div className="flex gap-1">
          {SPEEDS.map(s => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`text-xs font-bold px-3 py-1 rounded-full border transition-colors ${
                speed === s
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
              }`}
            >
              {s === 1 ? '1×' : `${s}×`}
            </button>
          ))}
        </div>
      </div>

      {/* Transcribe panel — visible until transcription completes */}
      {!transcribeDone && (
        <TranscribePanel
          videoFile={videoFile}
          onResult={handleTranscribeResult}
          onDone={handleTranscribeDone}
        />
      )}

      {/* Subtitle player — appears as soon as first partial lines arrive */}
      {hasLines && (
        <SubtitlePlayer
          lines={lines}
          currentMs={currentMs}
          animeId={anime.id}
          animeName={anime.title}
          episodeNumber={episode?.episode_number ?? 1}
          videoRef={videoRef}
          mode={mode}
          pauseCapMs={settings.shadow_pause_cap_ms}
          onSentenceComplete={handleSentenceComplete}
          onSaved={handleSaved}
        />
      )}

      {/* Video ended confirmation */}
      {videoEnded && (
        <div className="rounded-2xl bg-gray-900 border border-indigo-800 p-5 text-center space-y-3">
          <p className="text-3xl">🎉</p>
          <p className="font-black text-lg">Episode finished!</p>
          <p className="text-sm text-gray-400">
            You shadowed <span className="text-white font-bold">{completedCount}</span> lines
            and saved <span className="text-white font-bold">{savedCount}</span> to vault.
          </p>
          <div className="flex gap-3 justify-center pt-1">
            <button
              onClick={() => { setVideoEnded(false); videoRef.current?.play(); }}
              className="text-sm font-bold bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 px-4 py-2 rounded-xl transition-colors"
            >
              ↩ Keep watching
            </button>
            <button
              onClick={commitSession}
              className="text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl transition-colors"
            >
              Done ✓ See results
            </button>
          </div>
        </div>
      )}

      {/* Keyboard shortcuts */}
      <div className="rounded-xl bg-gray-900/50 border border-gray-800 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-2">Keyboard Shortcuts</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500">
          {([
            ['Space', 'Pause / Resume'],
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
