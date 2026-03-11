import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SKILL_TEMPLATES, MOTIVATION_SEEDS } from '../data/skillTemplates';
import { upsertLocalSkill, upsertLocalMotivation, getLocalSkills } from '../lib/storage';
import type { Skill, SubSkill, Drill, Motivation } from '../types';

function makeId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function TemplateLibraryPage() {
  const navigate = useNavigate();
  const existingSkills = getLocalSkills();
  const [cloned, setCloned] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);

  const categories = Array.from(new Set(SKILL_TEMPLATES.map(t => t.category)));

  function handleClone(templateId: string) {
    const tpl = SKILL_TEMPLATES.find(t => t.id === templateId);
    if (!tpl) return;

    const alreadyExists = existingSkills.some(s => s.name === tpl.name);
    if (alreadyExists) {
      navigate('/skills');
      return;
    }

    const skillId = makeId();
    const skill: Skill = {
      id: skillId,
      user_id: 'guest',
      name: tpl.name,
      category: tpl.category,
      icon: tpl.icon,
      created_at: new Date().toISOString(),
      sub_skills: tpl.sub_skills.map((ss, si): SubSkill => ({
        id: makeId(),
        skill_id: skillId,
        name: ss.name,
        description: ss.description,
        order_index: si,
        drills: ss.drills.map((d): Drill => ({
          id: makeId(),
          sub_skill_id: '',
          name: d.name,
          description: d.description,
          duration_secs: d.duration_secs,
          target_reps: d.target_reps,
          difficulty: d.difficulty,
        })),
      })),
    };

    upsertLocalSkill(skill);

    // Seed motivations
    const seeds = MOTIVATION_SEEDS[templateId] ?? MOTIVATION_SEEDS['default'];
    seeds.forEach(stmt => {
      const m: Motivation = {
        id: makeId(),
        user_id: 'guest',
        statement: stmt,
        is_favourite: false,
        category: 'battle_cry',
        created_at: new Date().toISOString(),
      };
      upsertLocalMotivation(m);
    });

    setCloned(prev => new Set(prev).add(templateId));
    navigate(`/skills/${skillId}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">📚 Skill Templates</h1>
        <p className="text-gray-400 text-sm mt-1">Choose a pre-built skill tree. You can customise every drill after cloning.</p>
      </div>

      {categories.map(cat => (
        <section key={cat} className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-orange-400">{cat}</h2>
          {SKILL_TEMPLATES.filter(t => t.category === cat).map(tpl => (
            <div key={tpl.id} className="rounded-2xl bg-gray-900 border border-gray-800 overflow-hidden">
              {/* Header */}
              <div className="p-4 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 flex-1">
                  <span className="text-3xl">{tpl.icon}</span>
                  <div>
                    <h3 className="font-bold">{tpl.name}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{tpl.description}</p>
                    <p className="text-xs text-gray-600 mt-1">{tpl.sub_skills.length} sub-skills · {tpl.sub_skills.reduce((a, ss) => a + ss.drills.length, 0)} drills</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handleClone(tpl.id)}
                    className="whitespace-nowrap text-xs font-semibold bg-orange-500 hover:bg-orange-400 text-white px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {cloned.has(tpl.id) ? '✓ Cloned' : 'Clone →'}
                  </button>
                  <button
                    onClick={() => setExpanded(expanded === tpl.id ? null : tpl.id)}
                    className="text-xs text-gray-500 hover:text-white transition-colors text-center"
                  >
                    {expanded === tpl.id ? 'Hide ▲' : 'Preview ▼'}
                  </button>
                </div>
              </div>

              {/* Expandable preview */}
              {expanded === tpl.id && (
                <div className="border-t border-gray-800 px-4 pb-4 space-y-3 pt-3">
                  {tpl.sub_skills.map(ss => (
                    <div key={ss.name}>
                      <p className="text-xs font-semibold text-orange-300 uppercase tracking-wide">{ss.name}</p>
                      <ul className="mt-1 space-y-1">
                        {ss.drills.map(d => (
                          <li key={d.name} className="text-xs text-gray-400 flex items-start gap-2">
                            <span className="text-orange-600 mt-0.5">{'★'.repeat(d.difficulty)}</span>
                            <span><span className="text-gray-200">{d.name}</span> — {d.description}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
