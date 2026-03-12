import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  getShadowSessions,
  getVaultEntries,
  getStreaks,
  getCurrentStreak,
  getTotalShadowMinutes,
  getTotalSentencesShadowed,
} from '../lib/shadowStorage';
import { ANIME_LIBRARY } from '../data/animeLibrary';

// ── helpers ──────────────────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, '0'); }

function SparkLine({ values, max, colour = '#818cf8' }: { values: number[]; max: number; colour?: string }) {
  if (values.length < 2) return null;
  const W = 100; const H = 32;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - (v / (max || 1)) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-8 overflow-visible">
      <polyline points={pts} fill="none" stroke={colour} strokeWidth="2"
        strokeLinejoin="round" strokeLinecap="round" />
      {values.map((v, i) => {
        const x = (i / (values.length - 1)) * W;
        const y = H - (v / (max || 1)) * H;
        return <circle key={i} cx={x} cy={y} r={2.5} fill={colour} />;
      })}
    </svg>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function ProgressDashboardPage() {
  const sessions       = getShadowSessions();
  const vault          = getVaultEntries();
  const streaks        = getStreaks();
  const currentStreak  = getCurrentStreak();
  const totalMinutes   = getTotalShadowMinutes();
  const totalSentences = getTotalSentencesShadowed();

  // ── per-anime stats ──────────────────────────────────────────────────────
  const animeStats = useMemo(() => {
    const map = new Map<string, { sessions: number; sentences: number; minutes: number; ratings: number[] }>();
    for (const s of sessions) {
      if (!map.has(s.anime_id)) map.set(s.anime_id, { sessions: 0, sentences: 0, minutes: 0, ratings: [] });
      const rec = map.get(s.anime_id)!;
      rec.sessions++;
      rec.sentences += s.sentences_completed;
      if (s.ended_at) {
        rec.minutes += Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000);
      }
      if (s.self_rating) rec.ratings.push(s.self_rating);
    }
    return [...map.entries()].map(([id, rec]) => ({
      id,
      anime: ANIME_LIBRARY.find(a => a.id === id),
      ...rec,
      avgRating: rec.ratings.length
        ? (rec.ratings.reduce((a, b) => a + b, 0) / rec.ratings.length).toFixed(1)
        : null,
    })).sort((a, b) => b.sentences - a.sentences);
  }, [sessions]);

  // ── self-rating trend (last 10 sessions with ratings) ────────────────────
  const ratingTrend = useMemo(() =>
    sessions.filter(s => s.self_rating).slice(0, 10).reverse().map(s => s.self_rating as number),
    [sessions]
  );

  // ── sentences per day (last 14 days) — for bar chart ────────────────────
  const last14 = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (13 - i));
      const dateStr = d.toISOString().split('T')[0];
      const streak  = streaks.find(s => s.date === dateStr);
      return {
        date:      dateStr,
        label:     `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`,
        sentences: streak?.sentences_shadowed ?? 0,
        minutes:   streak?.minutes_practiced  ?? 0,
        active:    !!(streak && streak.sentences_shadowed > 0),
      };
    });
  }, [streaks]);

  const maxSentences = Math.max(...last14.map(d => d.sentences), 1);

  // ── vault tag breakdown ──────────────────────────────────────────────────
  const tagStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of vault) {
      for (const t of e.tags) map.set(t, (map.get(t) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [vault]);

  // ── mode breakdown ───────────────────────────────────────────────────────
  const modeCounts = useMemo(() => {
    const m = { watch: 0, shadow: 0, dictation: 0 };
    for (const s of sessions) m[s.mode] = (m[s.mode] ?? 0) + 1;
    return m;
  }, [sessions]);

  if (sessions.length === 0) {
    return (
      <div className="text-center py-20 space-y-4">
        <p className="text-5xl">📊</p>
        <p className="font-bold">No data yet</p>
        <p className="text-gray-400 text-sm">Complete your first shadowing session to see progress here.</p>
        <Link to="/session" className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-lg">
          Start Shadowing
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">📊 Progress</h1>
        <Link to="/session" className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg font-semibold">
          + Session
        </Link>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard emoji="🔥" value={`${currentStreak}d`}     label="Current Streak" />
        <StatCard emoji="🗣️" value={totalSentences}       label="Sentences Shadowed" />
        <StatCard emoji="⏱"  value={`${totalMinutes}m`}   label="Total Practice" />
        <StatCard emoji="📚" value={vault.length}          label="Vault Entries" />
      </div>

      {/* Activity bar chart — last 14 days */}
      <section className="rounded-2xl bg-gray-900 border border-gray-800 p-4 space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-indigo-400">Daily Activity (last 14 days)</p>
        <div className="flex items-end gap-1 h-16">
          {last14.map(day => (
            <div key={day.date} className="flex-1 flex flex-col items-center gap-0.5">
              <div
                className={`w-full rounded-t transition-all ${
                  day.active ? 'bg-indigo-500' : 'bg-gray-800'
                }`}
                style={{ height: day.sentences > 0 ? `${Math.max((day.sentences / maxSentences) * 52, 6)}px` : '4px' }}
                title={`${day.date}: ${day.sentences} sentences, ${day.minutes}min`}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-gray-700">
          <span>{last14[0].label}</span>
          <span>Today</span>
        </div>
        <p className="text-xs text-gray-500">
          {currentStreak > 0
            ? `🔥 ${currentStreak}-day streak — keep going!`
            : 'No streak yet — practice today to start one!'}
        </p>
      </section>

      {/* Self-rating trend */}
      {ratingTrend.length >= 2 && (
        <section className="rounded-2xl bg-gray-900 border border-gray-800 p-4 space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-400">Self-Rating Trend</p>
          <SparkLine values={ratingTrend} max={5} colour="#818cf8" />
          <div className="flex justify-between text-xs text-gray-600">
            <span>older</span>
            <span>
              {ratingTrend[ratingTrend.length - 1] > ratingTrend[0]
                ? '📈 Improving'
                : ratingTrend[ratingTrend.length - 1] < ratingTrend[0]
                ? '📉 Harder lately — normal!'
                : '➡️ Consistent'}
            </span>
            <span>latest</span>
          </div>
        </section>
      )}

      {/* Mode breakdown */}
      <section className="rounded-2xl bg-gray-900 border border-gray-800 p-4 space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-indigo-400">Mode Breakdown</p>
        <div className="grid grid-cols-3 gap-2 text-center">
          {([
            ['👀', 'Watch',     modeCounts.watch],
            ['🗣️', 'Shadow',    modeCounts.shadow],
            ['✏️', 'Dictation', modeCounts.dictation],
          ] as const).map(([emoji, label, count]) => (
            <div key={label} className="rounded-xl bg-gray-800 py-3">
              <p className="text-xl">{emoji}</p>
              <p className="text-lg font-black">{count}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Per-anime breakdown */}
      {animeStats.length > 0 && (
        <section className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-400">Per-Anime Breakdown</p>
          {animeStats.map(({ id, anime, sessions: sc, sentences, minutes, avgRating }) => (
            <div key={id} className="rounded-2xl bg-gray-900 border border-gray-800 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{anime?.cover_emoji ?? '🎬'}</span>
                  <div>
                    <p className="font-bold text-sm">{anime?.title ?? id}</p>
                    <p className="text-xs text-gray-500">{sc} session{sc !== 1 ? 's' : ''} · {minutes}min</p>
                  </div>
                </div>
                <div className="text-right">
                  {avgRating && <p className="text-xl font-black text-indigo-400">{avgRating}<span className="text-xs text-gray-500">/5</span></p>}
                  <p className="text-xs text-gray-500">{sentences} shadowed</p>
                </div>
              </div>
              {/* Sentences progress bar */}
              <div className="w-full bg-gray-800 rounded-full h-1.5">
                <div
                  className="bg-indigo-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${Math.min((sentences / Math.max(totalSentences, 1)) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-600">{sentences} of {totalSentences} total sentences</p>
            </div>
          ))}
        </section>
      )}

      {/* Vault tag breakdown */}
      {tagStats.length > 0 && (
        <section className="rounded-2xl bg-gray-900 border border-gray-800 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-400">Top Vault Tags</p>
            <Link to="/vault" className="text-xs text-gray-500 hover:text-white">View all →</Link>
          </div>
          <div className="space-y-2">
            {tagStats.map(([tag, count]) => (
              <div key={tag} className="flex items-center gap-3">
                <span className="text-xs text-gray-300 w-24 truncate">{tag}</span>
                <div className="flex-1 bg-gray-800 rounded-full h-2">
                  <div
                    className="bg-indigo-500 h-2 rounded-full"
                    style={{ width: `${(count / (tagStats[0][1] || 1)) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent sessions */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-400">Recent Sessions</p>
          <Link to="/session/history" className="text-xs text-gray-500 hover:text-white">View all →</Link>
        </div>
        {sessions.slice(0, 5).map(s => {
          const mins = s.ended_at
            ? Math.max(1, Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000))
            : 0;
          const anime = ANIME_LIBRARY.find(a => a.id === s.anime_id);
          return (
            <div key={s.id} className="rounded-xl bg-gray-900 border border-gray-800 px-4 py-3 flex items-center gap-3">
              <span className="text-xl">{anime?.cover_emoji ?? '🎬'}</span>
              <div className="flex-1">
                <p className="text-sm font-semibold">{s.anime_title}</p>
                <p className="text-xs text-gray-500">
                  Ep.{s.episode_number} · {s.mode} · {mins}min · {s.sentences_completed} shadowed
                </p>
              </div>
              {s.self_rating && (
                <span className="text-sm font-black text-indigo-400">{s.self_rating}/5</span>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}

function StatCard({ emoji, value, label }: { emoji: string; value: string | number; label: string }) {
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
