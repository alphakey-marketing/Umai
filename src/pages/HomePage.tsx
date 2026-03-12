import { Link } from 'react-router-dom';
import {
  getShadowSessions,
  getVaultEntries,
  getCurrentStreak,
  getTotalSentencesShadowed,
  getTotalShadowMinutes,
  getLatestShadowSession,
} from '../lib/shadowStorage';
import { ANIME_LIBRARY } from '../data/animeLibrary';

export default function HomePage() {
  const sessions          = getShadowSessions();
  const vault             = getVaultEntries();
  const streak            = getCurrentStreak();
  const totalSentences    = getTotalSentencesShadowed();
  const totalMinutes      = getTotalShadowMinutes();
  const latest            = getLatestShadowSession();

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="text-center space-y-3 pt-4">
        <h1 className="text-4xl font-black tracking-tight">
          <span className="text-indigo-400">うまい</span> — Get Good at Japanese.
        </h1>
        <p className="text-gray-400 text-base max-w-md mx-auto">
          Shadow anime. Save sentences. Build fluency one line at a time.
        </p>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard value={streak}           label="Day Streak"  emoji="🔥" />
        <StatCard value={sessions.length}  label="Sessions"    emoji="🎌" />
        <StatCard value={totalSentences}   label="Shadowed"    emoji="🗣️" />
        <StatCard value={vault.length}     label="In Vault"    emoji="📚" />
      </section>

      {/* Primary CTA */}
      <section className="grid gap-3">
        <Link
          to="/session"
          className="group block rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-900 p-5 hover:from-indigo-500 hover:to-indigo-800 transition-all"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-200 mb-1">
                {latest ? `Last: ${latest.anime_title} Ep.${latest.episode_number}` : 'Ready to train?'}
              </p>
              <h2 className="text-xl font-bold">Start Shadowing</h2>
              <p className="text-sm text-indigo-100 mt-1">
                Pick an anime, load subtitles, shadow sentence by sentence.
              </p>
            </div>
            <span className="text-4xl">🎌</span>
          </div>
        </Link>

        <div className="grid grid-cols-3 gap-3">
          <Link to="/vault" className="rounded-2xl bg-gray-800 p-4 hover:bg-gray-700 transition-colors">
            <span className="text-3xl block mb-2">📚</span>
            <h3 className="font-bold text-sm">Vault</h3>
            <p className="text-xs text-gray-400 mt-0.5">{vault.length} saved</p>
          </Link>
          <Link to="/progress" className="rounded-2xl bg-gray-800 p-4 hover:bg-gray-700 transition-colors">
            <span className="text-3xl block mb-2">📊</span>
            <h3 className="font-bold text-sm">Progress</h3>
            <p className="text-xs text-gray-400 mt-0.5">{totalMinutes} min total</p>
          </Link>
          <Link to="/templates" className="rounded-2xl bg-gray-800 p-4 hover:bg-gray-700 transition-colors">
            <span className="text-3xl block mb-2">🎬</span>
            <h3 className="font-bold text-sm">Anime</h3>
            <p className="text-xs text-gray-400 mt-0.5">{ANIME_LIBRARY.length} titles</p>
          </Link>
        </div>
      </section>

      {/* Anime Quick Pick */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-400">Start with an anime</h2>
        <div className="grid grid-cols-1 gap-2">
          {ANIME_LIBRARY.map(anime => (
            <Link
              key={anime.id}
              to={`/session?anime=${anime.id}`}
              className="flex items-center gap-4 rounded-2xl bg-gray-800 p-4 hover:bg-gray-700 transition-colors"
            >
              <span className="text-3xl">{anime.cover_emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{anime.title}</p>
                <p className="text-xs text-gray-400 truncate">{anime.title_en}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <JLPTBadge level={anime.jlpt_level} />
                <p className="text-xs text-gray-500">{anime.tags[0]}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* How shadowing works */}
      <section className="rounded-2xl bg-gray-900 border border-gray-800 p-5 space-y-3">
        <h2 className="font-bold text-sm uppercase tracking-widest text-indigo-400">How Shadowing Works</h2>
        <div className="grid grid-cols-3 gap-2 pt-1">
          {([
            ['👂', 'Listen', 'Hear the sentence from native audio'],
            ['🗣️', 'Shadow', 'Repeat out loud, matching rhythm & tone'],
            ['📚', 'Save', 'Tap S to vault words you want to remember'],
          ] as const).map(([emoji, title, desc]) => (
            <div key={title} className="text-center space-y-1">
              <div className="text-2xl">{emoji}</div>
              <p className="text-xs font-bold text-white">{title}</p>
              <p className="text-xs text-gray-500 leading-tight">{desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({ value, label, emoji }: { value: number; label: string; emoji: string }) {
  return (
    <div className="rounded-2xl bg-gray-800 p-4 flex items-center gap-3">
      <span className="text-3xl">{emoji}</span>
      <div>
        <p className="text-2xl font-black">{value}</p>
        <p className="text-xs text-gray-400">{label}</p>
      </div>
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
    <span className={`text-xs border px-2 py-0.5 rounded-full font-bold ${colours[level] ?? 'bg-gray-800 text-gray-400'}`}>
      {level}
    </span>
  );
}
