import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getLocalSkills, upsertLocalSkill } from '../lib/storage';
import type { Skill, SubSkill, Drill } from '../types';

function makeId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const DIFFICULTY_LABELS: Record<number, string> = { 1: 'Beginner', 2: 'Easy', 3: 'Medium', 4: 'Hard', 5: 'Expert' };
const DIFFICULTY_COLORS: Record<number, string> = {
  1: 'text-green-400', 2: 'text-lime-400', 3: 'text-yellow-400', 4: 'text-orange-400', 5: 'text-red-400',
};

export default function SkillDetailPage() {
  const { skillId } = useParams<{ skillId: string }>();
  const [skill, setSkill] = useState<Skill | null>(() =>
    getLocalSkills().find(s => s.id === skillId) ?? null
  );

  // Sub-skill form
  const [showSSForm, setShowSSForm] = useState(false);
  const [ssName, setSSName] = useState('');
  const [ssDesc, setSSDesc] = useState('');

  // Drill form
  const [drillParentId, setDrillParentId] = useState<string | null>(null);
  const [drillName, setDrillName] = useState('');
  const [drillDesc, setDrillDesc] = useState('');
  const [drillDuration, setDrillDuration] = useState(0);
  const [drillReps, setDrillReps] = useState(10);
  const [drillDiff, setDrillDiff] = useState<1|2|3|4|5>(3);

  function save(updated: Skill) {
    upsertLocalSkill(updated);
    setSkill({ ...updated });
  }

  function addSubSkill() {
    if (!skill || !ssName.trim()) return;
    const ss: SubSkill = {
      id: makeId(),
      skill_id: skill.id,
      name: ssName.trim(),
      description: ssDesc.trim(),
      order_index: skill.sub_skills.length,
      drills: [],
    };
    save({ ...skill, sub_skills: [...skill.sub_skills, ss] });
    setSSName(''); setSSDesc(''); setShowSSForm(false);
  }

  function deleteSubSkill(ssId: string) {
    if (!skill) return;
    save({ ...skill, sub_skills: skill.sub_skills.filter(s => s.id !== ssId) });
  }

  function addDrill(ssId: string) {
    if (!skill || !drillName.trim()) return;
    const drill: Drill = {
      id: makeId(),
      sub_skill_id: ssId,
      name: drillName.trim(),
      description: drillDesc.trim(),
      duration_secs: drillDuration,
      target_reps: drillReps,
      difficulty: drillDiff,
    };
    save({
      ...skill,
      sub_skills: skill.sub_skills.map(ss =>
        ss.id === ssId ? { ...ss, drills: [...ss.drills, drill] } : ss
      ),
    });
    setDrillName(''); setDrillDesc(''); setDrillDuration(0); setDrillReps(10); setDrillDiff(3);
    setDrillParentId(null);
  }

  function deleteDrill(ssId: string, drillId: string) {
    if (!skill) return;
    save({
      ...skill,
      sub_skills: skill.sub_skills.map(ss =>
        ss.id === ssId ? { ...ss, drills: ss.drills.filter(d => d.id !== drillId) } : ss
      ),
    });
  }

  if (!skill) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400">Skill not found.</p>
        <Link to="/skills" className="text-orange-400 text-sm mt-2 inline-block">← Back to My Skills</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/skills" className="text-gray-500 hover:text-white text-sm">← Skills</Link>
        <span className="text-gray-700">/</span>
        <div className="flex items-center gap-2">
          <span className="text-2xl">{skill.icon}</span>
          <h1 className="text-xl font-black">{skill.name}</h1>
        </div>
      </div>

      {/* Sub-skill list */}
      <div className="space-y-4">
        {skill.sub_skills.length === 0 && (
          <div className="text-center py-10 rounded-2xl bg-gray-900 border border-dashed border-gray-700">
            <p className="text-gray-500 text-sm">No sub-skills yet. Add one below to start building your drill tree.</p>
          </div>
        )}

        {skill.sub_skills.map(ss => (
          <div key={ss.id} className="rounded-2xl bg-gray-900 border border-gray-800 overflow-hidden">
            {/* Sub-skill header */}
            <div className="px-4 py-3 flex items-center justify-between bg-gray-800/50">
              <div>
                <p className="font-bold">{ss.name}</p>
                {ss.description && <p className="text-xs text-gray-400 mt-0.5">{ss.description}</p>}
              </div>
              <div className="flex gap-2 items-center">
                <button
                  onClick={() => setDrillParentId(drillParentId === ss.id ? null : ss.id)}
                  className="text-xs bg-orange-600 hover:bg-orange-500 text-white px-2 py-1 rounded-lg transition-colors"
                >
                  + Drill
                </button>
                <button onClick={() => deleteSubSkill(ss.id)} className="text-gray-600 hover:text-red-400 text-xs transition-colors">🗑</button>
              </div>
            </div>

            {/* Drill list */}
            <div className="divide-y divide-gray-800">
              {ss.drills.map(d => (
                <div key={d.id} className="px-4 py-3 flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{d.name}</p>
                      <span className={`text-xs font-semibold ${DIFFICULTY_COLORS[d.difficulty]}`}>{DIFFICULTY_LABELS[d.difficulty]}</span>
                    </div>
                    {d.description && <p className="text-xs text-gray-500 mt-0.5">{d.description}</p>}
                    <div className="flex gap-3 mt-1 text-xs text-gray-600">
                      {d.duration_secs > 0 && <span>⏱ {Math.floor(d.duration_secs/60)}m {d.duration_secs%60 > 0 ? `${d.duration_secs%60}s` : ''}</span>}
                      {d.target_reps > 0 && <span>🔁 {d.target_reps} reps</span>}
                    </div>
                  </div>
                  <button onClick={() => deleteDrill(ss.id, d.id)} className="text-gray-700 hover:text-red-400 text-xs transition-colors shrink-0">🗑</button>
                </div>
              ))}
            </div>

            {/* Add drill form */}
            {drillParentId === ss.id && (
              <div className="border-t border-orange-900/50 bg-gray-950 p-4 space-y-2">
                <p className="text-xs font-semibold text-orange-400 uppercase tracking-wide">Add Drill to {ss.name}</p>
                <input
                  value={drillName}
                  onChange={e => setDrillName(e.target.value)}
                  placeholder="Drill name"
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-orange-500"
                />
                <textarea
                  value={drillDesc}
                  onChange={e => setDrillDesc(e.target.value)}
                  placeholder="Description (how to do it)"
                  rows={2}
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-orange-500 resize-none"
                />
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-gray-500">Duration (secs)</label>
                    <input type="number" min={0} value={drillDuration} onChange={e => setDrillDuration(+e.target.value)}
                      className="w-full bg-gray-800 rounded-lg px-2 py-1.5 text-sm border border-gray-700 focus:outline-none focus:border-orange-500 mt-0.5" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Target Reps</label>
                    <input type="number" min={0} value={drillReps} onChange={e => setDrillReps(+e.target.value)}
                      className="w-full bg-gray-800 rounded-lg px-2 py-1.5 text-sm border border-gray-700 focus:outline-none focus:border-orange-500 mt-0.5" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Difficulty</label>
                    <select value={drillDiff} onChange={e => setDrillDiff(+e.target.value as 1|2|3|4|5)}
                      className="w-full bg-gray-800 rounded-lg px-2 py-1.5 text-sm border border-gray-700 focus:outline-none focus:border-orange-500 mt-0.5">
                      {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} — {DIFFICULTY_LABELS[n]}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => addDrill(ss.id)} className="flex-1 bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold py-2 rounded-lg transition-colors">Add Drill</button>
                  <button onClick={() => setDrillParentId(null)} className="px-4 text-sm text-gray-400 hover:text-white">Cancel</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add sub-skill */}
      {showSSForm ? (
        <div className="rounded-2xl bg-gray-900 border border-orange-700 p-4 space-y-3">
          <p className="text-xs font-semibold text-orange-400 uppercase tracking-wide">New Sub-Skill</p>
          <input
            value={ssName}
            onChange={e => setSSName(e.target.value)}
            placeholder="Sub-skill name (e.g. Footwork)"
            className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-orange-500"
          />
          <input
            value={ssDesc}
            onChange={e => setSSDesc(e.target.value)}
            placeholder="Short description (optional)"
            className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-orange-500"
          />
          <div className="flex gap-2">
            <button onClick={addSubSkill} className="flex-1 bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold py-2 rounded-lg transition-colors">Add Sub-Skill</button>
            <button onClick={() => setShowSSForm(false)} className="px-4 text-sm text-gray-400 hover:text-white">Cancel</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowSSForm(true)}
          className="w-full rounded-2xl border border-dashed border-gray-700 py-3 text-sm text-gray-500 hover:text-white hover:border-orange-600 transition-colors"
        >
          + Add Sub-Skill
        </button>
      )}
    </div>
  );
}
