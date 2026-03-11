import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getLocalSkills, deleteLocalSkill, upsertLocalSkill } from '../lib/storage';
import type { Skill } from '../types';

function makeId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function MySkillsPage() {
  const [skills, setSkills] = useState<Skill[]>(getLocalSkills);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🎯');
  const [category, setCategory] = useState('Custom');

  function refresh() { setSkills(getLocalSkills()); }

  function handleAdd() {
    if (!name.trim()) return;
    const skill: Skill = {
      id: makeId(),
      user_id: 'guest',
      name: name.trim(),
      category: category.trim() || 'Custom',
      icon,
      created_at: new Date().toISOString(),
      sub_skills: [],
    };
    upsertLocalSkill(skill);
    setName(''); setIcon('🎯'); setCategory('Custom');
    setShowForm(false);
    refresh();
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this skill and all its drills?')) return;
    deleteLocalSkill(id);
    refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">⚡ My Skills</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-sm bg-orange-500 hover:bg-orange-400 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors"
        >
          + New Skill
        </button>
      </div>

      {/* Add skill form */}
      {showForm && (
        <div className="rounded-2xl bg-gray-900 border border-orange-700 p-4 space-y-3">
          <h2 className="font-bold text-sm">Create a custom skill</h2>
          <div className="flex gap-2">
            <input
              value={icon}
              onChange={e => setIcon(e.target.value)}
              className="w-14 text-center text-xl bg-gray-800 rounded-lg px-2 py-2 border border-gray-700 focus:outline-none focus:border-orange-500"
              maxLength={2}
            />
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Skill name (e.g. Tennis)"
              className="flex-1 bg-gray-800 rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-orange-500"
            />
          </div>
          <input
            value={category}
            onChange={e => setCategory(e.target.value)}
            placeholder="Category (e.g. Sport, Music, Language)"
            className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-orange-500"
          />
          <div className="flex gap-2">
            <button onClick={handleAdd} className="flex-1 bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold py-2 rounded-lg transition-colors">Add Skill</button>
            <button onClick={() => setShowForm(false)} className="px-4 text-sm text-gray-400 hover:text-white">Cancel</button>
          </div>
          <p className="text-xs text-gray-500">💡 Or save time — <Link to="/templates" className="text-orange-400 underline">browse pre-built templates</Link> with drills already included.</p>
        </div>
      )}

      {/* Empty state */}
      {skills.length === 0 && !showForm && (
        <div className="text-center py-16 space-y-3">
          <p className="text-5xl">🌱</p>
          <p className="font-bold">No skills yet</p>
          <p className="text-gray-400 text-sm">Start with a template or create your own.</p>
          <Link to="/templates" className="inline-block mt-2 bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            Browse Templates
          </Link>
        </div>
      )}

      {/* Skill cards */}
      <div className="space-y-3">
        {skills.map(skill => (
          <div key={skill.id} className="rounded-2xl bg-gray-900 border border-gray-800 p-4 flex items-center justify-between gap-3">
            <Link to={`/skills/${skill.id}`} className="flex items-center gap-3 flex-1 min-w-0">
              <span className="text-3xl">{skill.icon}</span>
              <div className="min-w-0">
                <p className="font-bold truncate">{skill.name}</p>
                <p className="text-xs text-gray-400">
                  {skill.category} · {skill.sub_skills.length} sub-skill{skill.sub_skills.length !== 1 ? 's' : ''} · {skill.sub_skills.reduce((a, ss) => a + ss.drills.length, 0)} drills
                </p>
              </div>
            </Link>
            <button
              onClick={() => handleDelete(skill.id)}
              className="text-xs text-gray-600 hover:text-red-400 transition-colors shrink-0"
            >
              🗑
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
