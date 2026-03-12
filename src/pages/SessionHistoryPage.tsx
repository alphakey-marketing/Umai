import { Link } from 'react-router-dom';
import { getShadowSessions } from '../lib/shadowStorage';

export default function SessionHistoryPage() {
  const sessions = getShadowSessions();

  if (sessions.length === 0) {
    return (
      <div className="text-center py-20 space-y-4">
        <p className="text-5xl">💬</p>
        <p className="font-bold">No sessions yet</p>
        <p className="text-gray-400 text-sm">Complete your first shadowing session to see history here.</p>
        <Link to="/session" className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-lg">
          Start Shadowing
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-black">💬 Session History</h1>
        <p className="text-gray-400 text-sm mt-1">{sessions.length} session{sessions.length !== 1 ? 's' : ''} logged</p>
      </header>

      <div className="space-y-3">
        {sessions.map(s => {
          const startMs = new Date(s.started_at).getTime();
          const endMs   = s.ended_at ? new Date(s.ended_at).getTime() : startMs;
          const minutes = Math.max(1, Math.round((endMs - startMs) / 60000));
          const date    = new Date(s.started_at).toLocaleDateString('en-HK', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
          });
          return (
            <div key={s.id} className="rounded-2xl bg-gray-800 p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-sm">{s.anime_title}</p>
                  <p className="text-xs text-gray-400">Ep. {s.episode_number} · {s.mode} mode · {date}</p>
                </div>
                {s.self_rating && (
                  <span className="text-lg font-black text-indigo-400">{s.self_rating}/5</span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <MiniStat value={minutes}             label="min" />
                <MiniStat value={s.sentences_completed} label="shadowed" />
                <MiniStat value={s.sentences_saved}   label="saved" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MiniStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl bg-gray-900 py-2">
      <p className="text-base font-black">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
