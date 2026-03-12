import { Link } from 'react-router-dom';
import { getLocalSkills, getLocalMotivations, getLocalSessions } from '../lib/storage';
import { isSupabaseAvailable } from '../lib/supabase';
import { isGeminiAvailable } from '../lib/gemini';

export default function HomePage() {
  const skills      = getLocalSkills();
  const motivations = getLocalMotivations();
  const sessions    = getLocalSessions();
  const totalMin    = Math.round(
    sessions.reduce((a, s) => a + s.drill_logs.reduce((b, l) => b + l.duration_actual_secs, 0), 0) / 60
  );

  return (
    <div className="space-y-8">
      <section className="text-center space-y-3 pt-4">
        <h1 className="text-4xl font-black tracking-tight">
          <span className="text-orange-400">Deliberate</span> Practice.
        </h1>
        <p className="text-gray-400 text-base max-w-md mx-auto">
          Every rep with intention. Every session with fire. Build real skill — not just hours.
        </p>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard value={skills.length}      label="Skills"      emoji="⚡" />
        <StatCard value={sessions.length}    label="Sessions"    emoji="🔥" />
        <StatCard value={totalMin}           label="Minutes"     emoji="⏱" />
        <StatCard value={motivations.length} label="Fire Stmts"  emoji="❤️‍🔥" />
      </section>

      {/* Primary CTAs */}
      <section className="grid gap-3">
        <Link to="/session" className="group block rounded-2xl bg-gradient-to-br from-orange-600 to-orange-800 p-5 hover:from-orange-500 hover:to-orange-700 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-orange-200 mb-1">Ready to train?</p>
              <h2 className="text-xl font-bold">Start a Session</h2>
              <p className="text-sm text-orange-100 mt-1">Pick your drills, see your fire statement, track your zones.</p>
            </div>
            <span className="text-4xl">🔥</span>
          </div>
        </Link>

        <div className="grid grid-cols-2 gap-3">
          <Link to="/progress" className="rounded-2xl bg-gray-800 p-4 hover:bg-gray-700 transition-colors">
            <span className="text-3xl block mb-2">📊</span>
            <h3 className="font-bold text-sm">Progress</h3>
            <p className="text-xs text-gray-400 mt-0.5">Focus trends & zone data</p>
          </Link>
          <Link to="/session/history" className="rounded-2xl bg-gray-800 p-4 hover:bg-gray-700 transition-colors">
            <span className="text-3xl block mb-2">📋</span>
            <h3 className="font-bold text-sm">History</h3>
            <p className="text-xs text-gray-400 mt-0.5">{sessions.length} session{sessions.length !== 1 ? 's' : ''} logged</p>
          </Link>
        </div>
      </section>

      {/* Integration status */}
      <section className="rounded-2xl bg-gray-900 border border-gray-800 p-4 space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest text-orange-400">Integrations</p>
        <div className="space-y-1.5">
          <IntegrationRow
            emoji="☁️"
            label="Supabase Sync"
            active={isSupabaseAvailable()}
            hint="Add VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY to .env"
          />
          <IntegrationRow
            emoji="✨"
            label="Gemini AI Drills"
            active={isGeminiAvailable()}
            hint="Add VITE_GEMINI_API_KEY to .env"
          />
        </div>
      </section>

      {/* What is DP */}
      <section className="rounded-2xl bg-gray-900 border border-gray-800 p-5 space-y-2">
        <h2 className="font-bold text-sm uppercase tracking-widest text-orange-400">What is Deliberate Practice?</h2>
        <p className="text-sm text-gray-300 leading-relaxed">
          It's not just doing the thing — it's targeting your weakest point, pushing past your comfort zone, and getting immediate feedback.
        </p>
        <div className="grid grid-cols-3 gap-2 pt-1">
          {[['🎯','Specific Goals'],['🔄','Focused Reps'],['📊','Feedback Loops']].map(([e,l]) => (
            <div key={l as string} className="text-center text-xs text-gray-400">
              <div className="text-2xl mb-1">{e}</div>{l}
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

function IntegrationRow({
  emoji, label, active, hint,
}: { emoji: string; label: string; active: boolean; hint: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-lg">{emoji}</span>
      <span className="text-sm flex-1">{label}</span>
      {active
        ? <span className="text-xs bg-green-900/50 text-green-400 border border-green-800 px-2 py-0.5 rounded-full font-semibold">Active</span>
        : <span className="text-xs text-gray-600" title={hint}>Not set</span>
      }
    </div>
  );
}
