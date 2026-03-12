import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { saveShadowSession } from '../lib/shadowStorage';
import type { ShadowingSession } from '../types';

interface LocationState {
  session: ShadowingSession;
  savedCount: number;
  completedCount: number;
}

export default function SessionFeedbackPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state    = location.state as LocationState | null;

  const [rating, setRating] = useState<1|2|3|4|5|null>(null);

  if (!state?.session) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400">No session data. <Link to="/" className="text-indigo-400 underline">Go home</Link></p>
      </div>
    );
  }

  const { session, savedCount, completedCount } = state;
  const startMs  = new Date(session.started_at).getTime();
  const endMs    = session.ended_at ? new Date(session.ended_at).getTime() : Date.now();
  const minutes  = Math.max(1, Math.round((endMs - startMs) / 60000));

  function handleSave() {
    if (!rating) return;
    saveShadowSession({ ...session, self_rating: rating });
    navigate('/session/history');
  }

  return (
    <div className="space-y-6">
      <header className="text-center space-y-2 pt-2">
        <p className="text-5xl">🎉</p>
        <h1 className="text-2xl font-black">Session Complete!</h1>
        <p className="text-gray-400 text-sm">{session.anime_title} · Ep. {session.episode_number}</p>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <StatCard value={minutes}          label="Minutes" emoji="⏱" />
        <StatCard value={completedCount}   label="Shadowed" emoji="🗣️" />
        <StatCard value={savedCount}       label="Saved" emoji="📚" />
      </div>

      {/* Mode badge */}
      <div className="text-center">
        <span className="text-xs font-bold bg-indigo-900/60 text-indigo-400 border border-indigo-800 px-3 py-1 rounded-full">
          {session.mode} mode
        </span>
      </div>

      {/* Self-rating */}
      <section className="space-y-3">
        <p className="text-sm font-bold text-center">How did it feel?</p>
        <div className="flex justify-center gap-3">
          {([1,2,3,4,5] as const).map(r => (
            <button
              key={r}
              onClick={() => setRating(r)}
              className={`w-12 h-12 rounded-2xl text-xl font-black border-2 transition-all ${
                rating === r
                  ? 'border-indigo-500 bg-indigo-950/50 scale-110'
                  : 'border-gray-700 bg-gray-900 hover:border-gray-500'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <p className="text-xs text-center text-gray-500">
          {rating === 1 ? '😓 Really tough — keep going!' :
           rating === 2 ? '🧐 Some parts were hard' :
           rating === 3 ? '😐 About right' :
           rating === 4 ? '😄 Feeling good!' :
           rating === 5 ? '🔥 Nailed it!' : 'Tap to rate'}
        </p>
      </section>

      {/* CTA buttons */}
      <div className="grid gap-3">
        <button
          onClick={handleSave}
          disabled={!rating}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold py-3 rounded-2xl transition-colors"
        >
          Save & Continue →
        </button>
        <div className="grid grid-cols-2 gap-3">
          <Link
            to="/vault"
            className="text-center text-sm font-bold bg-gray-800 hover:bg-gray-700 py-3 rounded-2xl transition-colors"
          >
            📚 View Vault
          </Link>
          <Link
            to="/session"
            className="text-center text-sm font-bold bg-gray-800 hover:bg-gray-700 py-3 rounded-2xl transition-colors"
          >
            🔁 New Session
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatCard({ value, label, emoji }: { value: number; label: string; emoji: string }) {
  return (
    <div className="rounded-2xl bg-gray-800 p-4 text-center">
      <p className="text-2xl">{emoji}</p>
      <p className="text-2xl font-black">{value}</p>
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  );
}
