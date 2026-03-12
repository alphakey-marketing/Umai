import { Link } from 'react-router-dom';
import { getLocalSessions } from '../lib/storage';
import type { ZoneRating } from '../types';

const ZONE_ICON: Record<ZoneRating, string> = {
  comfort: '🟢', learning: '🟡', panic: '🔴',
};

export default function SessionHistoryPage() {
  const sessions = getLocalSessions();

  if (sessions.length === 0) {
    return (
      <div className="text-center py-20 space-y-4">
        <p className="text-5xl">📋</p>
        <p className="font-bold">No sessions yet</p>
        <p className="text-gray-400 text-sm">Complete a session and your history will appear here.</p>
        <Link to="/session" className="inline-block bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold px-4 py-2 rounded-lg">Start a Session</Link>
      </div>
    );
  }

  // Group by skill
  const bySkill = sessions.reduce<Record<string, typeof sessions>>((acc, s) => {
    (acc[s.skill_name] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">📋 Session History</h1>
        <Link to="/session" className="text-sm bg-orange-500 hover:bg-orange-400 text-white px-3 py-1.5 rounded-lg font-semibold">+ New</Link>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-3 text-center">
          <p className="text-2xl font-black">{sessions.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Sessions</p>
        </div>
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-3 text-center">
          <p className="text-2xl font-black">
            {Math.round(sessions.reduce((a, s) => a + s.drill_logs.reduce((b, l) => b + l.duration_actual_secs, 0), 0) / 60)}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Minutes</p>
        </div>
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-3 text-center">
          <p className="text-2xl font-black">
            {sessions.length > 0
              ? Math.round(sessions.reduce((a, s) => a + s.focus_score, 0) / sessions.length)
              : 0}%
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Avg Focus</p>
        </div>
      </div>

      {/* Sessions by skill */}
      {Object.entries(bySkill).map(([skillName, skillSessions]) => (
        <section key={skillName} className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-widest text-orange-400">
            {skillSessions[0].skill_icon} {skillName}
          </h2>
          {skillSessions.map(s => {
            const totalSecs = s.drill_logs.reduce((a, l) => a + l.duration_actual_secs, 0);
            const date = new Date(s.started_at).toLocaleDateString('en-HK', { month: 'short', day: 'numeric' });
            const allZones = s.drill_logs.flatMap(l => l.zone_ratings);
            return (
              <div key={s.id} className="rounded-xl bg-gray-900 border border-gray-800 p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-sm">{date}</p>
                    <p className="text-xs text-gray-500">{Math.floor(totalSecs / 60)}m · {s.drill_logs.length} drills · {s.focus_score}% focus</p>
                  </div>
                  <div className="flex gap-0.5">
                    {([1,2,3,4,5] as const).map(n => (
                      <span key={n} className={n <= s.overall_rating ? 'text-orange-400' : 'text-gray-700'}>★</span>
                    ))}
                  </div>
                </div>
                {/* Zone pill row */}
                <div className="flex gap-1 flex-wrap">
                  {allZones.map((z, i) => (
                    <span key={i} className="text-xs">{ZONE_ICON[z]}</span>
                  ))}
                </div>
                {s.went_well && (
                  <p className="text-xs text-gray-400 italic">✓ {s.went_well}</p>
                )}
                {s.improve_next && (
                  <p className="text-xs text-gray-500 italic">→ {s.improve_next}</p>
                )}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
