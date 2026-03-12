import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { getLocalSkills, saveLocalSession } from '../lib/storage';
import type { Session, DrillLog, ZoneRating } from '../types';

const REFLECT_PROMPTS = [
  'What was the hardest moment today, and what did you do?',
  'If you could redo one drill, what would you change?',
  'What surprised you about this session?',
  'Which drill felt most like the learning zone?',
  'What's one thing you'll do differently next session?',
];

function makeId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function calcFocusScore(logs: DrillLog[]): number {
  const all: ZoneRating[] = logs.flatMap(l => l.zone_ratings);
  if (all.length === 0) return 0;
  return Math.round((all.filter(z => z === 'learning').length / all.length) * 100);
}

export default function SessionFeedbackPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { skillId, drillLogs, sessionStart } =
    (location.state ?? {}) as { skillId: string; drillLogs: DrillLog[]; sessionStart: string };

  const skill = getLocalSkills().find(s => s.id === skillId);
  const focusScore = calcFocusScore(drillLogs ?? []);
  const totalSecs = (drillLogs ?? []).reduce((a, l) => a + l.duration_actual_secs, 0);
  const totalMin = Math.floor(totalSecs / 60);

  const [rating, setRating] = useState<1|2|3|4|5>(3);
  const [wentWell, setWentWell] = useState('');
  const [improveNext, setImproveNext] = useState('');
  const prompt = REFLECT_PROMPTS[Math.floor(Math.random() * REFLECT_PROMPTS.length)];

  function handleSave() {
    if (!skill) return;
    const session: Session = {
      id: makeId(),
      user_id: 'guest',
      skill_id: skill.id,
      skill_name: skill.name,
      skill_icon: skill.icon,
      started_at: sessionStart ?? new Date().toISOString(),
      ended_at: new Date().toISOString(),
      drill_logs: drillLogs ?? [],
      overall_rating: rating,
      went_well: wentWell.trim(),
      improve_next: improveNext.trim(),
      focus_score: focusScore,
    };
    saveLocalSession(session);
    navigate('/session/history', { replace: true });
  }

  if (!skill) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400">Session data missing.</p>
        <Link to="/session" className="text-orange-400 text-sm mt-2 inline-block">← Back</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2 pt-2">
        <p className="text-5xl">🎉</p>
        <h1 className="text-2xl font-black">Session Complete!</h1>
        <p className="text-gray-400 text-sm">{skill.icon} {skill.name} · {totalMin}m {totalSecs % 60}s</p>
      </div>

      {/* Focus score card */}
      <div className={`rounded-2xl p-5 text-center ${
        focusScore >= 70 ? 'bg-yellow-950/40 border border-yellow-700' :
        focusScore >= 40 ? 'bg-orange-950/40 border border-orange-800' :
        'bg-gray-900 border border-gray-800'
      }`}>
        <p className="text-5xl font-black">{focusScore}%</p>
        <p className="text-sm font-semibold mt-1">Focus Score (time in 🟡 learning zone)</p>
        {focusScore >= 70 && <p className="text-yellow-300 text-sm mt-2">🔥 You were in the zone today!</p>}
        {focusScore < 40 && focusScore > 0 && <p className="text-gray-400 text-xs mt-2">Try adjusting drill difficulty next session to stay in the learning zone.</p>}
      </div>

      {/* Zone breakdown */}
      {drillLogs.length > 0 && (
        <div className="rounded-2xl bg-gray-900 border border-gray-800 p-4 space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-orange-400">Drill Breakdown</p>
          {drillLogs.map(l => {
            const z = l.zone_ratings[0];
            const icon = z === 'comfort' ? '🟢' : z === 'learning' ? '🟡' : '🔴';
            return (
              <div key={l.drill_id} className="flex items-center justify-between text-sm">
                <span className="text-gray-300">{l.drill_name}</span>
                <span>{icon} {Math.floor(l.duration_actual_secs / 60)}m {l.duration_actual_secs % 60}s</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Star rating */}
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest text-orange-400">Overall Session Rating</p>
        <div className="flex gap-2 justify-center">
          {([1,2,3,4,5] as const).map(n => (
            <button
              key={n}
              onClick={() => setRating(n)}
              className={`text-3xl transition-transform hover:scale-125 ${
                n <= rating ? 'text-orange-400' : 'text-gray-700'
              }`}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      {/* Reflection prompts */}
      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-orange-400">Reflect</p>
        <p className="text-sm text-gray-400 italic">{prompt}</p>
        <textarea
          value={wentWell}
          onChange={e => setWentWell(e.target.value)}
          placeholder="What went well?"
          rows={2}
          className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-orange-500 resize-none"
        />
        <textarea
          value={improveNext}
          onChange={e => setImproveNext(e.target.value)}
          placeholder="What will you improve next time?"
          rows={2}
          className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-orange-500 resize-none"
        />
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        className="w-full bg-orange-500 hover:bg-orange-400 text-white font-bold py-4 rounded-2xl transition-colors"
      >
        Save Session & View History
      </button>
    </div>
  );
}
