import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ANIME_LIBRARY } from '../data/animeLibrary';
import { parseSubtitleFile } from '../lib/subtitleParser';
import { isWhisperAvailable } from '../lib/whisperClient';
import type { AnimeTitle, ShadowingMode, SubtitleLine } from '../types';

export default function SessionSetupPage() {
  const navigate      = useNavigate();
  const [params]      = useSearchParams();

  const preAnimeId    = params.get('anime') ?? '';
  const preEpisode    = parseInt(params.get('episode') ?? '1', 10);

  const [anime, setAnime]           = useState<AnimeTitle | null>(
    ANIME_LIBRARY.find(a => a.id === preAnimeId) ?? null
  );
  const [episodeNum, setEpisodeNum] = useState(preEpisode || 1);
  const [mode, setMode]             = useState<ShadowingMode>('shadow');
  const [srtText, setSrtText]       = useState<string | null>(null);
  const [srtName, setSrtName]       = useState<string>('');
  const [videoFile, setVideoFile]   = useState<File | null>(null);
  const [error, setError]           = useState<string | null>(null);

  // When anime changes, reset episode to 1
  useEffect(() => { setEpisodeNum(1); }, [anime?.id]);

  function handleSRTUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setSrtText(ev.target?.result as string);
      setSrtName(file.name);
      setError(null);
    };
    reader.readAsText(file, 'utf-8');
  }

  function handleVideoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoFile(file);
    setError(null);
  }

  function handleStart() {
    if (!anime) { setError('Please select an anime.'); return; }
    if (!videoFile) { setError('Please upload a video file.'); return; }

    let parsedLines: SubtitleLine[] = [];
    if (srtText) {
      try {
        parsedLines = parseSubtitleFile(srtText);
        if (parsedLines.length === 0) {
          setError('Subtitle file parsed but found 0 lines. Check the file format.');
          return;
        }
      } catch {
        setError('Failed to parse subtitle file. Make sure it\'s a valid .srt or .vtt file.');
        return;
      }
    }

    const episode = anime.episodes.find(ep => ep.episode_number === episodeNum);
    navigate('/session/run', {
      state: {
        anime,
        episode,
        mode,
        subtitleLines: parsedLines,
        videoObjectURL: URL.createObjectURL(videoFile),
      },
    });
  }

  const MODES: { value: ShadowingMode; label: string; desc: string; emoji: string }[] = [
    { value: 'watch',     label: 'Watch',     emoji: '👀', desc: 'Just watch with Japanese subtitles' },
    { value: 'shadow',    label: 'Shadow',    emoji: '🗣️', desc: 'Auto-pause each line. Repeat aloud.' },
    { value: 'dictation', label: 'Dictation', emoji: '✏️', desc: 'Subtitles hidden. Guess then reveal.' },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-black">🎬 Setup Session</h1>
        <p className="text-gray-400 text-sm mt-1">Choose your anime, upload video + subtitles, pick a mode.</p>
      </header>

      {/* Anime selector */}
      <section className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-widest text-indigo-400">Anime</label>
        {anime ? (
          <div className="flex items-center gap-3 rounded-xl bg-gray-800 px-4 py-3">
            <span className="text-3xl">{anime.cover_emoji}</span>
            <div className="flex-1">
              <p className="font-bold text-sm">{anime.title}</p>
              <p className="text-xs text-gray-400">{anime.title_en}</p>
            </div>
            <button onClick={() => setAnime(null)} className="text-xs text-gray-500 hover:text-white">Change</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
            {ANIME_LIBRARY.map(a => (
              <button
                key={a.id}
                onClick={() => setAnime(a)}
                className="flex items-center gap-3 rounded-xl bg-gray-800 hover:bg-gray-700 px-4 py-3 text-left transition-colors"
              >
                <span className="text-2xl">{a.cover_emoji}</span>
                <div className="flex-1">
                  <p className="text-sm font-bold">{a.title}</p>
                  <p className="text-xs text-gray-400">{a.title_en}</p>
                </div>
                <JLPTBadge level={a.jlpt_level} />
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Episode picker */}
      {anime && (
        <section className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-widest text-indigo-400">Episode</label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setEpisodeNum(n => Math.max(1, n - 1))}
              className="w-10 h-10 rounded-xl bg-gray-800 hover:bg-gray-700 font-bold text-lg"
            >-</button>
            <span className="flex-1 text-center text-xl font-black">Ep. {episodeNum}</span>
            <button
              onClick={() => setEpisodeNum(n => Math.min(anime.episode_count, n + 1))}
              className="w-10 h-10 rounded-xl bg-gray-800 hover:bg-gray-700 font-bold text-lg"
            >+</button>
          </div>
        </section>
      )}

      {/* Mode selector */}
      <section className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-widest text-indigo-400">Mode</label>
        <div className="grid grid-cols-3 gap-2">
          {MODES.map(m => (
            <button
              key={m.value}
              onClick={() => setMode(m.value)}
              className={`rounded-xl border-2 p-3 text-left transition-all ${
                mode === m.value
                  ? 'border-indigo-500 bg-indigo-950/40'
                  : 'border-gray-700 bg-gray-900 hover:border-gray-500'
              }`}
            >
              <span className="text-2xl block mb-1">{m.emoji}</span>
              <p className="text-xs font-bold">{m.label}</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-tight">{m.desc}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Video upload */}
      <section className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-widest text-indigo-400">Video File</label>
        <label className={`flex items-center gap-3 rounded-xl border-2 border-dashed px-4 py-3 cursor-pointer transition-colors ${
          videoFile ? 'border-indigo-600 bg-indigo-950/20' : 'border-gray-700 hover:border-gray-500'
        }`}>
          <span className="text-2xl">{videoFile ? '🎥' : '📂'}</span>
          <div className="flex-1">
            <p className="text-sm font-bold">{videoFile ? videoFile.name : 'Upload video'}</p>
            <p className="text-xs text-gray-500">mp4, mkv, webm — stays local, never uploaded</p>
          </div>
          <input type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />
        </label>
      </section>

      {/* SRT / VTT upload */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-widest text-indigo-400">Subtitle File</label>
          <span className="text-xs text-gray-600">optional — .srt or .vtt</span>
        </div>
        <label className={`flex items-center gap-3 rounded-xl border-2 border-dashed px-4 py-3 cursor-pointer transition-colors ${
          srtText ? 'border-indigo-600 bg-indigo-950/20' : 'border-gray-700 hover:border-gray-500'
        }`}>
          <span className="text-2xl">{srtText ? '📝' : '📄'}</span>
          <div className="flex-1">
            <p className="text-sm font-bold">{srtText ? srtName : 'Upload .srt / .vtt'}</p>
            <p className="text-xs text-gray-500">
              {srtText ? 'Subtitle loaded ✓' : 'Skip to use Whisper AI (requires API key)'}
            </p>
          </div>
          <input type="file" accept=".srt,.vtt,text/*" className="hidden" onChange={handleSRTUpload} />
        </label>
        {!srtText && (
          <p className={`text-xs px-1 ${
            isWhisperAvailable() ? 'text-green-400' : 'text-gray-600'
          }`}>
            {isWhisperAvailable()
              ? '✓ Whisper AI ready — will auto-transcribe on session start'
              : 'Whisper not configured (add VITE_OPENAI_API_KEY to .env to enable)'}
          </p>
        )}
      </section>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-400 bg-red-950/30 border border-red-900 rounded-xl px-4 py-2">{error}</p>
      )}

      {/* Start button */}
      <button
        onClick={handleStart}
        disabled={!anime || !videoFile}
        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-base py-4 rounded-2xl transition-colors"
      >
        ▶ Start Shadowing
      </button>

      <p className="text-center text-xs text-gray-600">
        No video? <Link to="/templates" className="text-indigo-400 hover:underline">Browse the anime library</Link> for recommendations.
      </p>
    </div>
  );
}

function JLPTBadge({ level }: { level: string }) {
  const colours: Record<string, string> = {
    N5: 'bg-green-900/60 text-green-400 border-green-800',
    N4: 'bg-blue-900/60 text-blue-400 border-blue-800',
    N3: 'bg-yellow-900/60 text-yellow-400 border-yellow-800',
    N2: 'bg-orange-900/60 text-orange-400 border-orange-800',
    N1: 'bg-red-900/60 text-red-400 border-red-800',
  };
  return (
    <span className={`text-xs border px-2 py-0.5 rounded-full font-bold ${colours[level] ?? ''}`}>
      {level}
    </span>
  );
}
