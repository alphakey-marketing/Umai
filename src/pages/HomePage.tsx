import { Link } from 'react-router-dom';
import { getLocalSkills, getLocalMotivations } from '../lib/storage';

export default function HomePage() {
  const skills = getLocalSkills();
  const motivations = getLocalMotivations();

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="text-center space-y-3 pt-4">
        <h1 className="text-4xl font-black tracking-tight">
          <span className="text-orange-400">Deliberate</span> Practice.
        </h1>
        <p className="text-gray-400 text-base max-w-md mx-auto">
          Every rep with intention. Every session with fire. Build real skill — not just hours.
        </p>
      </section>

      {/* Quick stats */}
      {skills.length > 0 && (
        <section className="grid grid-cols-2 gap-3">
          <StatCard value={skills.length} label="Skills" emoji="⚡" />
          <StatCard value={motivations.length} label="Fire Statements" emoji="❤️‍🔥" />
        </section>
      )}

      {/* CTA cards */}
      <section className="grid gap-3">
        <Link to="/templates" className="group block rounded-2xl bg-gradient-to-br from-orange-600 to-orange-800 p-5 hover:from-orange-500 hover:to-orange-700 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-orange-200 mb-1">Start here</p>
              <h2 className="text-xl font-bold">Browse Skill Templates</h2>
              <p className="text-sm text-orange-100 mt-1">Pick badminton, singing, Japanese &amp; more — pre-built drill trees ready to go.</p>
            </div>
            <span className="text-4xl">📚</span>
          </div>
        </Link>

        <div className="grid grid-cols-2 gap-3">
          <Link to="/skills" className="rounded-2xl bg-gray-800 p-4 hover:bg-gray-700 transition-colors">
            <span className="text-3xl block mb-2">⚡</span>
            <h3 className="font-bold text-sm">My Skills</h3>
            <p className="text-xs text-gray-400 mt-0.5">{skills.length} skill{skills.length !== 1 ? 's' : ''} saved</p>
          </Link>
          <Link to="/vault" className="rounded-2xl bg-gray-800 p-4 hover:bg-gray-700 transition-colors">
            <span className="text-3xl block mb-2">❤️‍🔥</span>
            <h3 className="font-bold text-sm">Motivation Vault</h3>
            <p className="text-xs text-gray-400 mt-0.5">{motivations.length} statement{motivations.length !== 1 ? 's' : ''}</p>
          </Link>
        </div>
      </section>

      {/* What is deliberate practice */}
      <section className="rounded-2xl bg-gray-900 border border-gray-800 p-5 space-y-2">
        <h2 className="font-bold text-sm uppercase tracking-widest text-orange-400">What is Deliberate Practice?</h2>
        <p className="text-sm text-gray-300 leading-relaxed">
          It's not just doing the thing — it's targeting your weakest point, pushing past your comfort zone, and getting immediate feedback. This is how experts are built.
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
