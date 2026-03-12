import { useRef, useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import VideoPlayer from '../components/VideoPlayer';
import SubtitlePlayer from '../components/SubtitlePlayer';
import TranscribePanel from '../components/TranscribePanel';
import { saveShadowSession, recordTodayActivity } from '../lib/shadowStorage';
import { retrieveFile, releaseFile } from '../lib/sessionFileStore';
import type {
  AnimeTitle, AnimeEpisode, ShadowingMode, SubtitleLine, ShadowingSession, VaultEntry,
} from '../types/index';

interface LocationState {
  anime:         AnimeTitle;
  episode:       AnimeEpisode;
  mode:          ShadowingMode;
  subtitleLines: SubtitleLine[];
  videoFileId:   string;   // key into sessionFileStore
}

export default function SessionRunPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const state     = location.state as LocationState | null;

  const videoRef                            = useRef<HTMLVideoElement>(null);
  const [currentMs, setCurrentMs]           = useState(0);
  const [lines, setLines]                   = useState<SubtitleLine[]>(state?.subtitleLines ?? []);
  const [savedCount, setSavedCount]         = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [videoSrc, setVideoSrc]             = useState<string | null>(null);
  const [videoFile, setVideoFile]           = useState<File | null>(null);
  const sessionStartRef                     = useRef(new Date().toISOString());
  const objectURLRef                        = useRef<string | null>(null);

  // Retrieve File from store and create a fresh objectURL on this page
  useEffect(() => {
    if (!state?.videoFileId) return;
    const file = retrieveFile(state.videoFileId);
    if (!file) return;
    setVideoFile(file);
    // Create objectURL here (on the page that owns the <video>) — never revoked until unmount
    const url = URL.createObjectURL(file);
    objectURLRef.current = url;
    setVideoSrc(url);
    return () => {
      // Clean up: revoke objectURL and release File from store on unmount
      if (objectURLRef.current) URL.revokeObjectURL(objectURLRef.current);
      releaseFile(state.videoFileId);
    };
  }, [state?.videoFileId]);

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

  const { anime, episode, mode } = state;

  const handleTranscribeResult = useCallback((result: SubtitleLine[]) => setLines(result), []);
  const handleSentenceComplete = useCallback((_line: SubtitleLine) => setCompletedCount(c => c + 1), []);
  const handleSaved            = useCallback((_entry: VaultEntry) => setSavedCount(c => c + 1), []);

  function handleEnd() {
    const now     = new Date().toISOString();
    const minutes = Math.max(1, Math.round(
      (new Date(now).getTime() - new Date(sessionStartRef.current).getTime()) / 60000
    ));
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="flex items-center gap-3">
        <span className="text-2xl">{anime.cover_emoji}</span>
        <div className="flex-1 min-w-0">
          <h1 className="font-black text-base truncate">{anime.title}</h1>
          <p className="text-xs text-gray-400">Ep. {episode?.episode_number ?? 1} · {mode} mode</p>
        </div>
        <button onClick={handleEnd}
          className="text-xs font-bold bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 px-3 py-1.5 rounded-full transition-colors">
          End ✓
        </button>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <MiniStat value={lines.length}   label="Lines" />
        <MiniStat value={completedCount} label="Shadowed" />
        <MiniStat value={savedCount}     label="Saved" />
      </div>

      {/* Video — src set only after objectURL is created on this page */}
      <VideoPlayer ref={videoRef} src={videoSrc} onTimeUpdate={setCurrentMs} onEnded={handleEnd} />

      {/* Transcribe panel — only when no SRT loaded */}
      {lines.length === 0 && (
        <TranscribePanel videoFile={videoFile} onResult={handleTranscribeResult} />
      )}

      {/* Subtitle player */}
      {lines.length > 0 && (
        <SubtitlePlayer
          lines={lines} currentMs={currentMs}
          animeId={anime.id} animeName={anime.title}
          episodeNumber={episode?.episode_number ?? 1}
          videoRef={videoRef} mode={mode}
          onSentenceComplete={handleSentenceComplete} onSaved={handleSaved}
        />
      )}

      {/* Keyboard shortcuts */}
      <div className="rounded-xl bg-gray-900/50 border border-gray-800 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-2">Shortcuts</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500">
          {(['Space/Play Pause', 'R/Replay line', 'H/Hide subtitle', 'S/Save to vault', '← →/Seek ±5s'] as const)
            .map(s => {
              const [key, desc] = s.split('/');
              return (
                <div key={key} className="flex gap-2">
                  <kbd className="bg-gray-800 border border-gray-700 rounded px-1 font-mono">{key}</kbd>
                  <span>{desc}</span>
                </div>
              );
            })}
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
