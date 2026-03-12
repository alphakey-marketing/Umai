import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getLocalSkills } from '../lib/storage';
import type { Drill } from '../types';

export default function SessionSetupPage() {
  const navigate = useNavigate();
  const skills = getLocalSkills();
  const [skillId, setSkillId] = useState(skills[0]?.id ?? '');
  const [selectedDrills, setSelectedDrills] = useState<string[]>([]);

  const skill = skills.find(s => s.id === skillId);
  const allDrills: (Drill & { subSkillName: string })[] =
    skill?.sub_skills.flatMap(ss => ss.drills.map(d => ({ ...d, subSkillName: ss.name }))) ?? [];

  function toggleDrill(id: string) {
    setSelectedDrills(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function handleStart() {
    if (!skill || selectedDrills.length === 0) return;
    // Pass selected drill ids + skill id via location state
    navigate('/session/run', {
      state: { skillId: skill.id, drillIds: selectedDrills },
    });
  }

  if (skills.length === 0) {
    return (
      <div className="text-center py-20 space-y-4">
        <p className="text-5xl">🌱</p>
        <p className="font-bold">No skills yet</p>
        <p className="text-gray-400 text-sm">Add a skill before starting a session.</p>
        <Link to="/templates" className="inline-block bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold px-4 py-2 rounded-lg">Browse Templates</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">🎯 Start a Session</h1>
        <p className="text-gray-400 text-sm mt-1">Pick your skill and the drills you want to focus on today.</p>
      </div>

      {/* Skill selector */}
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-widest text-orange-400">Skill</label>
        <div className="grid grid-cols-2 gap-2">
          {skills.map(s => (
            <button
              key={s.id}
              onClick={() => { setSkillId(s.id); setSelectedDrills([]); }}
              className={`rounded-xl border-2 p-3 text-left transition-all ${
                skillId === s.id
                  ? 'border-orange-500 bg-orange-950/30'
                  : 'border-gray-700 bg-gray-900 hover:border-gray-500'
              }`}
            >
              <span className="text-2xl block">{s.icon}</span>
              <span className="text-sm font-semibold mt-1 block">{s.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Drill selector */}
      {skill && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-widest text-orange-400">Drills for Today</label>
            <button
              onClick={() =>
                selectedDrills.length === allDrills.length
                  ? setSelectedDrills([])
                  : setSelectedDrills(allDrills.map(d => d.id))
              }
              className="text-xs text-gray-500 hover:text-white"
            >
              {selectedDrills.length === allDrills.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          {skill.sub_skills.map(ss => (
            <div key={ss.id}>
              <p className="text-xs text-orange-300 font-semibold uppercase tracking-wide mb-1">{ss.name}</p>
              <div className="space-y-1">
                {ss.drills.map(d => (
                  <button
                    key={d.id}
                    onClick={() => toggleDrill(d.id)}
                    className={`w-full text-left rounded-xl border px-4 py-3 transition-all flex items-center justify-between gap-3 ${
                      selectedDrills.includes(d.id)
                        ? 'border-orange-500 bg-orange-950/20'
                        : 'border-gray-700 bg-gray-900 hover:border-gray-600'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium">{d.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {d.duration_secs > 0 ? `⏱ ${Math.floor(d.duration_secs / 60)}m` : ''}
                        {d.duration_secs > 0 && d.target_reps > 0 ? ' · ' : ''}
                        {d.target_reps > 0 ? `🔁 ${d.target_reps} reps` : ''}
                      </p>
                    </div>
                    <span className={`text-lg ${selectedDrills.includes(d.id) ? 'text-orange-400' : 'text-gray-700'}`}>
                      {selectedDrills.includes(d.id) ? '✓' : '○'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Start button */}
      <button
        onClick={handleStart}
        disabled={selectedDrills.length === 0}
        className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white font-bold text-base py-4 rounded-2xl transition-colors"
      >
        🔥 Begin Session ({selectedDrills.length} drill{selectedDrills.length !== 1 ? 's' : ''})
      </button>
    </div>
  );
}
