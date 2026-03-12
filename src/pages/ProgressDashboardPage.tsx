import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getLocalSessions, getLocalSkills } from '../lib/storage';
import type { Session, ZoneRating } from '../types';

const ZONE_COLOUR: Record<ZoneRating, string> = {
  comfort:  'bg-green-500',
  learning: 'bg-yellow-400',
  panic:    'bg-red-500',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-HK', { month: 'short', day: 'numeric' });
}

function focusColour(score: number) {
  if (score >= 70) return 'text-yellow-400';
  if (score >= 40) return 'text-orange-400';
  return 'text-red-400';
}

function sparkLine(values: number[], max: number) {
  if (values.length === 0) return null;
  const w = 80;
  const h = 28;
  const pts = values.map((v, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * w;
    const y = h - (v / (max || 1)) * h;
    return `${x},${y}`;
  });
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke="#f97316"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {values.map((v, i) => {
        const x = (i / Math.max(values.length - 1, 1)) * w;
        const y = h - (v / (max || 1)) * h;
        return <circle key={i} cx={x} cy={y} r={2.5} fill="#f97316" />;
      })}
    </svg>
  );
}

export default function ProgressDashboardPage() {
  const sessions  = getLocalSessions();
  const skills    = getLocalSkills();

  const totalSecs = useMemo(
    () => sessions.reduce((a, s) => a + s.drill_logs.reduce((b, l) => b + l.duration_actual_secs, 0), 0),
    [sessions],
  );
  const avgFocus = useMemo(
    () => sessions.length ? Math.round(sessions.reduce((a, s) => a + s.focus_score, 0) / sessions.length) : 0,
    [sessions],
  );
  const streakDays = useMemo(() => {
    if (sessions.length === 0) return 0;
    const days = [...new Set(sessions.map(s => s.started_at.slice(0, 10)))].sort().reverse();
    const today = new Date().toISOString().slice(0, 10);
    let streak = 0;
    let cursor = new Date(today);
    for (const day of days) {
      const d = cursor.toISOString().slice(0, 10);
      if (day === d) { streak++; cursor.setDate(cursor.getDate() - 1); }
      else break;
    }
    return streak;
  }, [sessions]);

  // Per-skill stats
  const skillStats = useMemo(() => {
    return skills.map(skill => {
      const ss = sessions.filter(s => s.skill_id === skill.id);
      const allZones = ss.flatMap(s => s.drill_logs.flatMap(l => l.zone_ratings));
      const zoneCount = {
        comfort:  allZones.filter(z => z === 'comfort').length,
        learning: allZones.filter(z => z === 'learning').length,
        panic:    allZones.filter(z => z === 'panic').length,
      };
      const totalZones = allZones.length || 1;
      const focusScores = ss.map(s => s.focus_score);
      const mins = Math.round(ss.reduce((a, s) => a + s.drill_logs.reduce((b, l) => b + l.duration_actual_secs, 0), 0) / 60);
      return { skill, sessionCount: ss.length, focusScores, zoneCount, totalZones, mins };
    }).filter(x => x.sessionCount > 0);
  }, [skills, sessions]);

  // Focus score trend (last 10 sessions)
  const focusTrend = useMemo(
    () => [...sessions].reverse().slice(0, 10).map(s => s.focus_score),
    [sessions],
  );

  // Recent sessions (last 5)
  const recent = sessions.slice(0, 5);

  if (sessions.length === 0) {
    return (
      <div className="text-center py-20 space-y-4">
        <p className="text-5xl">📊</p>
        <p className="font-bold">No data yet</p>
        <p className="text-gray-400 text-sm">Complete your first session to see your progress dashboard.</p>
        <Link to="/session" className="inline-block bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold px-4 py-2 rounded-lg">Start a Session</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">📊 Progress</h1>
        <Link to="/session" className="text-sm bg-orange-500 hover:bg-orange-400 text-white px-3 py-1.5 rounded-lg font-semibold">+ Session</Link>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard emoji="🔥" value={sessions.length}            label="Sessions" />
        <StatCard emoji="⏱"  value={`${Math.floor(totalSecs / 60)}m`} label="Total Time" />
        <StatCard emoji="🟡" value={`${avgFocus}%`}            label="Avg Focus" />
        <StatCard emoji="📅" value={`${streakDays}d`}          label="Streak" />
      </div>

      {/* Focus score trend chart */}
      {focusTrend.length >= 2 && (
        <div className="rounded-2xl bg-gray-900 border border-gray-800 p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-orange-400 mb-3">Focus Score Trend (last {focusTrend.length} sessions)</p>
          <div className="flex items-end gap-1">
            {focusTrend.map((score, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-gray-500">{score}%</span>
                <div
                  className={`w-full rounded-t-sm transition-all ${focusColour(score).replace('text-', 'bg-').replace('400', '500')}`}
                  style={{ height: `${Math.max(score * 0.6, 4)}px` }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-700 mt-1">
            <span>oldest</span><span>latest</span>
          </div>
          <div className="mt-3 flex items-center gap-3">
            {sparkLine(focusTrend, 100)}
            <p className="text-xs text-gray-500">
              {focusTrend[focusTrend.length - 1] > focusTrend[0]
                ? '📈 Focus improving'
                : focusTrend[focusTrend.length - 1] < focusTrend[0]
                ? '📉 Focus declining — try adjusting drill difficulty'
                : '➡️ Focus holding steady'}
            </p>
          </div>
        </div>
      )}

      {/* Per-skill breakdown */}
      {skillStats.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-orange-400">Per-Skill Breakdown</p>
          {skillStats.map(({ skill, sessionCount, focusScores, zoneCount, totalZones, mins }) => {
            const avgSkillFocus = focusScores.length
              ? Math.round(focusScores.reduce((a, b) => a + b, 0) / focusScores.length)
              : 0;
            return (
              <div key={skill.id} className="rounded-2xl bg-gray-900 border border-gray-800 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{skill.icon}</span>
                    <div>
                      <p className="font-bold text-sm">{skill.name}</p>
                      <p className="text-xs text-gray-500">{sessionCount} session{sessionCount !== 1 ? 's' : ''} · {mins}m</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-black ${focusColour(avgSkillFocus)}`}>{avgSkillFocus}%</p>
                    <p className="text-xs text-gray-600">avg focus</p>
                  </div>
                </div>

                {/* Zone distribution bar */}
                <div>
                  <p className="text-xs text-gray-600 mb-1">Zone distribution</p>
                  <div className="flex rounded-full overflow-hidden h-3">
                    {(['comfort', 'learning', 'panic'] as const).map(z => (
                      <div
                        key={z}
                        className={ZONE_COLOUR[z]}
                        style={{ width: `${(zoneCount[z] / totalZones) * 100}%` }}
                        title={`${z}: ${zoneCount[z]}`}
                      />
                    ))}
                  </div>
                  <div className="flex gap-3 mt-1">
                    {(['comfort', 'learning', 'panic'] as const).map(z => (
                      <span key={z} className="text-xs text-gray-600">
                        {z === 'comfort' ? '🟢' : z === 'learning' ? '🟡' : '🔴'} {Math.round((zoneCount[z] / totalZones) * 100)}%
                      </span>
                    ))}
                  </div>
                </div>

                {/* Mini focus sparkline */}
                {focusScores.length >= 2 && (
                  <div className="flex items-center gap-2">
                    {sparkLine(focusScores, 100)}
                    <span className="text-xs text-gray-600">focus trend</span>
                  </div>
                )}

                <Link
                  to={`/skills/${skill.id}`}
                  className="block text-center text-xs text-orange-400 hover:text-orange-300 border border-orange-900/40 rounded-lg py-1.5 transition-colors"
                >
                  View Drills & AI Suggestions →
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {/* Recent sessions */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-widest text-orange-400">Recent Sessions</p>
          <Link to="/session/history" className="text-xs text-gray-500 hover:text-white">View all →</Link>
        </div>
        {recent.map(s => {
          const totalS = s.drill_logs.reduce((a, l) => a + l.duration_actual_secs, 0);
          return (
            <div key={s.id} className="rounded-xl bg-gray-900 border border-gray-800 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">{s.skill_icon}</span>
                <div>
                  <p className="text-sm font-semibold">{s.skill_name}</p>
                  <p className="text-xs text-gray-500">{formatDate(s.started_at)} · {Math.floor(totalS / 60)}m</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-sm font-bold ${focusColour(s.focus_score)}`}>{s.focus_score}%</p>
                <p className="text-xs text-gray-600">focus</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Supabase sync banner */}
      {!import.meta.env.VITE_SUPABASE_URL && (
        <div className="rounded-2xl border border-dashed border-gray-700 p-4 text-center space-y-1">
          <p className="text-xs font-bold text-gray-500">☁️ Cloud Sync not enabled</p>
          <p className="text-xs text-gray-600">Add <code className="text-orange-400">VITE_SUPABASE_URL</code> + <code className="text-orange-400">VITE_SUPABASE_ANON_KEY</code> to your <code>.env</code> to sync across devices.</p>
        </div>
      )}
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
