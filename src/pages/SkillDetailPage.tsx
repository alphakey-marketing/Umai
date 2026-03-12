import { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getLocalSkills, upsertLocalSkill, getSessionsForSkill } from '../lib/storage';
import { fetchAIDrillSuggestions, isGeminiAvailable } from '../lib/gemini';
import type { SubSkill, Drill, AIDrillSuggestion } from '../types';

function makeId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const DIFF_LABELS = ['', '⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐⭐⭐'];
const DIFF_COLOURS = ['', 'text-green-400', 'text-green-400', 'text-yellow-400', 'text-orange-400', 'text-red-400'];

export default function SkillDetailPage() {
  const { skillId } = useParams<{ skillId: string }>();
  const [skills, setSkills] = useState(getLocalSkills);
  const skill = skills.find(s => s.id === skillId);

  // AI state
  const [aiLoading, setAiLoading] = useState<string | null>(null); // subSkillId loading
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, AIDrillSuggestion[]>>({});
  const [aiError, setAiError] = useState<string | null>(null);

  function save(updated: typeof skills[0]) {
    upsertLocalSkill(updated);
    setSkills(getLocalSkills());
  }

  function addSubSkill() {
    if (!skill) return;
    const name = prompt('Sub-skill name:');
    if (!name?.trim()) return;
    const newSS: SubSkill = {
      id: makeId(), skill_id: skill.id, name: name.trim(),
      description: '', order_index: skill.sub_skills.length, drills: [],
    };
    save({ ...skill, sub_skills: [...skill.sub_skills, newSS] });
  }

  function deleteSubSkill(ssId: string) {
    if (!skill) return;
    if (!confirm('Delete this sub-skill and all its drills?')) return;
    save({ ...skill, sub_skills: skill.sub_skills.filter(ss => ss.id !== ssId) });
  }

  function addDrill(ssId: string) {
    if (!skill) return;
    const name = prompt('Drill name:');
    if (!name?.trim()) return;
    const desc   = prompt('Description:') ?? '';
    const secs   = parseInt(prompt('Duration (seconds, 0 for rep-only):') ?? '0', 10);
    const reps   = parseInt(prompt('Target reps (0 for time-only):') ?? '0', 10);
    const diff   = parseInt(prompt('Difficulty 1-5:') ?? '3', 10) as Drill['difficulty'];
    const newDrill: Drill = {
      id: makeId(), sub_skill_id: ssId, name: name.trim(),
      description: desc, duration_secs: secs, target_reps: reps,
      difficulty: (diff >= 1 && diff <= 5 ? diff : 3),
    };
    save({
      ...skill,
      sub_skills: skill.sub_skills.map(ss =>
        ss.id === ssId ? { ...ss, drills: [...ss.drills, newDrill] } : ss
      ),
    });
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

  // Add an AI-suggested drill to the skill tree
  function adoptSuggestion(ssId: string, suggestion: AIDrillSuggestion) {
    if (!skill) return;
    const newDrill: Drill = {
      id: makeId(),
      sub_skill_id: ssId,
      name: suggestion.name,
      description: suggestion.description,
      duration_secs: suggestion.duration_secs,
      target_reps: suggestion.target_reps,
      difficulty: suggestion.difficulty,
    };
    save({
      ...skill,
      sub_skills: skill.sub_skills.map(ss =>
        ss.id === ssId ? { ...ss, drills: [...ss.drills, newDrill] } : ss
      ),
    });
    // Remove from suggestions list
    setAiSuggestions(prev => ({
      ...prev,
      [ssId]: (prev[ssId] ?? []).filter(s => s.name !== suggestion.name),
    }));
  }

  const fetchSuggestions = useCallback(async (ssId: string) => {
    if (!skill) return;
    const ss = skill.sub_skills.find(x => x.id === ssId);
    if (!ss) return;
    setAiLoading(ssId);
    setAiError(null);
    try {
      const sessions = getSessionsForSkill(skill.id);
      const suggestions = await fetchAIDrillSuggestions(skill.name, ss, sessions);
      setAiSuggestions(prev => ({ ...prev, [ssId]: suggestions }));
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : 'AI request failed');
    } finally {
      setAiLoading(null);
    }
  }, [skill]);

  if (!skill) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400">Skill not found.</p>
        <Link to="/skills" className="text-orange-400 text-sm mt-2 inline-block">← Back to Skills</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/skills" className="text-gray-500 hover:text-white text-sm">← Skills</Link>
        <span className="text-gray-700">/</span>
        <span className="text-xl">{skill.icon}</span>
        <h1 className="text-xl font-black">{skill.name}</h1>
      </div>

      {!isGeminiAvailable() && (
        <div className="rounded-xl border border-dashed border-gray-700 p-3 text-center">
          <p className="text-xs text-gray-500">
            💡 AI drill suggestions available — add <code className="text-orange-400">VITE_GEMINI_API_KEY</code> to your <code>.env</code> to unlock.
          </p>
        </div>
      )}

      {aiError && (
        <div className="rounded-xl bg-red-950/40 border border-red-800 p-3">
          <p className="text-xs text-red-400">⚠️ {aiError}</p>
        </div>
      )}

      {skill.sub_skills.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-700 p-8 text-center space-y-2">
          <p className="text-4xl">🌱</p>
          <p className="text-gray-400 text-sm">No sub-skills yet. Add your first one below.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {skill.sub_skills.map(ss => {
            const suggestions = aiSuggestions[ss.id] ?? [];
            const loading = aiLoading === ss.id;
            return (
              <div key={ss.id} className="rounded-2xl bg-gray-900 border border-gray-800 p-4 space-y-3">
                {/* Sub-skill header */}
                <div className="flex items-center justify-between">
                  <p className="font-bold text-orange-300">{ss.name}</p>
                  <div className="flex gap-2 items-center">
                    {isGeminiAvailable() && (
                      <button
                        onClick={() => fetchSuggestions(ss.id)}
                        disabled={loading}
                        className="text-xs px-2 py-1 rounded-lg bg-purple-900/40 border border-purple-700/50 text-purple-300 hover:bg-purple-900/70 disabled:opacity-50 transition-colors"
                      >
                        {loading ? '✨ Thinking…' : '✨ AI Drills'}
                      </button>
                    )}
                    <button onClick={() => addDrill(ss.id)} className="text-xs text-orange-400 hover:text-orange-300">+ Drill</button>
                    <button onClick={() => deleteSubSkill(ss.id)} className="text-gray-700 hover:text-red-400 text-sm">🗑</button>
                  </div>
                </div>

                {/* Existing drills */}
                {ss.drills.length === 0 ? (
                  <p className="text-xs text-gray-600 italic">No drills yet — add one or try AI Drills.</p>
                ) : (
                  <div className="space-y-2">
                    {ss.drills.map(d => (
                      <div key={d.id} className="flex items-start justify-between gap-3 bg-gray-800 rounded-xl px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{d.name}</p>
                            <span className={`text-xs ${DIFF_COLOURS[d.difficulty]}`}>{DIFF_LABELS[d.difficulty]}</span>
                          </div>
                          {d.description && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{d.description}</p>}
                          <div className="flex gap-3 mt-1 text-xs text-gray-600">
                            {d.duration_secs > 0 && <span>⏱ {Math.floor(d.duration_secs / 60)}m{d.duration_secs % 60 > 0 ? ` ${d.duration_secs % 60}s` : ''}</span>}
                            {d.target_reps > 0 && <span>🔁 {d.target_reps} reps</span>}
                          </div>
                        </div>
                        <button onClick={() => deleteDrill(ss.id, d.id)} className="text-gray-700 hover:text-red-400 text-sm shrink-0">🗑</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* AI Suggestions */}
                {loading && (
                  <div className="rounded-xl bg-purple-950/30 border border-purple-800/50 p-3 text-center">
                    <p className="text-sm text-purple-300 animate-pulse">✨ Gemini is analysing your session data…</p>
                  </div>
                )}

                {suggestions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-widest text-purple-400">✨ AI Suggested Drills</p>
                    {suggestions.map(sg => (
                      <div key={sg.name} className="rounded-xl bg-purple-950/20 border border-purple-800/40 px-3 py-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-purple-100">{sg.name}</p>
                            <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{sg.description}</p>
                            <p className="text-xs text-purple-400 italic mt-1">💡 {sg.reasoning}</p>
                            <div className="flex gap-3 mt-1 text-xs text-gray-600">
                              {sg.duration_secs > 0 && <span>⏱ {Math.floor(sg.duration_secs / 60)}m</span>}
                              {sg.target_reps > 0 && <span>🔁 {sg.target_reps} reps</span>}
                              <span className={DIFF_COLOURS[sg.difficulty]}>{DIFF_LABELS[sg.difficulty]}</span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => adoptSuggestion(ss.id, sg)}
                          className="w-full text-xs bg-purple-700 hover:bg-purple-600 text-white font-semibold py-1.5 rounded-lg transition-colors"
                        >
                          + Add to My Drills
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={addSubSkill}
        className="w-full border-2 border-dashed border-gray-700 hover:border-orange-700 text-gray-500 hover:text-orange-400 rounded-2xl py-4 text-sm font-semibold transition-colors"
      >
        + Add Sub-Skill
      </button>
    </div>
  );
}
