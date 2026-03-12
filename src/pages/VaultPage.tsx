import { useState } from 'react';
import {
  getLocalMotivations,
  upsertLocalMotivation,
  deleteLocalMotivation,
} from '../lib/storage';
import { PROVE_THEM_WRONG_PRESETS } from '../data/skillTemplates';
import type { Motivation } from '../types';

function makeId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const CATEGORIES: { value: Motivation['category']; label: string; emoji: string }[] = [
  { value: 'battle_cry',       label: 'Battle Cry',       emoji: '⚔️' },
  { value: 'prove_them_wrong', label: 'Prove Them Wrong',  emoji: '😤' },
  { value: 'future_self',      label: 'Future Self',       emoji: '🌟' },
  { value: 'why_i_started',    label: 'Why I Started',     emoji: '🌱' },
];

export default function VaultPage() {
  const [motivations, setMotivations] = useState<Motivation[]>(getLocalMotivations);
  const [statement, setStatement] = useState('');
  const [category, setCategory] = useState<Motivation['category']>('battle_cry');
  const [filter, setFilter] = useState<Motivation['category'] | 'all'>('all');
  const [showPresets, setShowPresets] = useState(false);
  const [rivalText, setRivalText] = useState(
    () => localStorage.getItem('umai_rival') ?? ''
  );
  const [editingRival, setEditingRival] = useState(false);

  function refresh() { setMotivations(getLocalMotivations()); }

  function handleAdd(text?: string) {
    const s = (text ?? statement).trim();
    if (!s) return;
    const m: Motivation = {
      id: makeId(),
      user_id: 'guest',
      statement: s,
      is_favourite: false,
      category: text ? 'prove_them_wrong' : category,
      created_at: new Date().toISOString(),
    };
    upsertLocalMotivation(m);
    if (!text) setStatement('');
    refresh();
  }

  function toggleFav(m: Motivation) {
    upsertLocalMotivation({ ...m, is_favourite: !m.is_favourite });
    refresh();
  }

  function handleDelete(id: string) {
    deleteLocalMotivation(id);
    refresh();
  }

  function saveRival() {
    localStorage.setItem('umai_rival', rivalText);
    setEditingRival(false);
  }

  const existingStatements = new Set(motivations.map(m => m.statement));
  const displayed = filter === 'all' ? motivations : motivations.filter(m => m.category === filter);
  const favourites = motivations.filter(m => m.is_favourite);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">❤️‍🔥 Motivation Vault</h1>
        <p className="text-gray-400 text-sm mt-1">Your personal fire. Shown before every session. Speak it. Mean it.</p>
      </div>

      {/* Rival Energy */}
      <div className="rounded-2xl bg-gray-900 border border-red-900/60 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-widest text-red-400">😤 Rival Energy — Private</p>
          {!editingRival && (
            <button onClick={() => setEditingRival(true)} className="text-xs text-gray-500 hover:text-white">Edit</button>
          )}
        </div>
        {editingRival ? (
          <>
            <textarea
              value={rivalText}
              onChange={e => setRivalText(e.target.value)}
              placeholder="Who or what are you proving wrong? Stays on your device only."
              rows={2}
              className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-red-500 resize-none"
            />
            <div className="flex gap-2">
              <button onClick={saveRival} className="flex-1 bg-red-700 hover:bg-red-600 text-white text-sm font-semibold py-1.5 rounded-lg transition-colors">Save</button>
              <button onClick={() => setEditingRival(false)} className="px-4 text-sm text-gray-400 hover:text-white">Cancel</button>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-300 italic">
            {rivalText || <span className="text-gray-600">Not set. Tap Edit to add your rival energy.</span>}
          </p>
        )}
      </div>

      {/* Prove Them Wrong Presets — UAT Fix */}
      <div className="rounded-2xl bg-gray-900 border border-gray-800 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-widest text-orange-400">😤 Prove Them Wrong — Quick Pick</p>
          <button
            onClick={() => setShowPresets(!showPresets)}
            className="text-xs text-gray-500 hover:text-white transition-colors"
          >
            {showPresets ? 'Hide ▲' : 'Show ▼'}
          </button>
        </div>
        <p className="text-xs text-gray-500">Tap any statement to instantly add it to your vault.</p>
        {showPresets && (
          <div className="space-y-2">
            {PROVE_THEM_WRONG_PRESETS.map(preset => {
              const added = existingStatements.has(preset);
              return (
                <button
                  key={preset}
                  disabled={added}
                  onClick={() => handleAdd(preset)}
                  className={`w-full text-left text-sm px-3 py-2 rounded-xl border transition-all ${
                    added
                      ? 'border-orange-800/40 bg-orange-950/20 text-orange-300/50 cursor-default'
                      : 'border-gray-700 bg-gray-800 hover:border-orange-500 hover:bg-orange-950/30 text-gray-200'
                  }`}
                >
                  <span className="mr-2">{added ? '✓' : '+'}</span>
                  {preset}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Write your own */}
      <div className="rounded-2xl bg-gray-900 border border-gray-800 p-4 space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-orange-400">Write Your Own Fire Statement</p>
        <textarea
          value={statement}
          onChange={e => setStatement(e.target.value)}
          placeholder='e.g. "If my footwork is stable, those who want me to lose will be so shocked."'
          rows={2}
          className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-orange-500 resize-none"
        />
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map(c => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                category === c.value
                  ? 'border-orange-500 bg-orange-500/20 text-orange-300'
                  : 'border-gray-700 text-gray-500 hover:text-white hover:border-gray-500'
              }`}
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => handleAdd()}
          disabled={!statement.trim()}
          className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
        >
          Add to Vault
        </button>
      </div>

      {/* Filter tabs */}
      {motivations.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {(['all', ...CATEGORIES.map(c => c.value)] as const).map(val => (
            <button
              key={val}
              onClick={() => setFilter(val as typeof filter)}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                filter === val
                  ? 'bg-orange-500 text-white font-semibold'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {val === 'all' ? '⚡ All' : (CATEGORIES.find(c => c.value === val)?.emoji + ' ' + CATEGORIES.find(c => c.value === val)?.label)}
            </button>
          ))}
        </div>
      )}

      {/* Starred spotlight */}
      {favourites.length > 0 && filter === 'all' && (
        <div className="rounded-2xl bg-gradient-to-br from-orange-950 to-gray-900 border border-orange-800/50 p-4 space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-orange-400">⭐ Starred — Shown Before Sessions</p>
          {favourites.map(m => (
            <p key={m.id} className="text-base font-semibold text-white leading-snug italic">"{m.statement}"</p>
          ))}
        </div>
      )}

      {/* Statement list */}
      <div className="space-y-2">
        {displayed.length === 0 && (
          <p className="text-center text-gray-600 py-8 text-sm">No statements in this category yet.</p>
        )}
        {displayed.map(m => {
          const cat = CATEGORIES.find(c => c.value === m.category);
          return (
            <div key={m.id} className={`rounded-xl border p-4 transition-all ${
              m.is_favourite ? 'border-orange-700 bg-orange-950/20' : 'border-gray-800 bg-gray-900'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-gray-100 leading-relaxed flex-1">{m.statement}</p>
                <div className="flex gap-2 shrink-0 items-center">
                  <button
                    onClick={() => toggleFav(m)}
                    className={`text-lg transition-transform hover:scale-125 ${
                      m.is_favourite ? 'text-orange-400' : 'text-gray-600 hover:text-orange-300'
                    }`}
                    title={m.is_favourite ? 'Unstar' : 'Star (shown pre-session)'}
                  >
                    {m.is_favourite ? '⭐' : '☆'}
                  </button>
                  <button onClick={() => handleDelete(m.id)} className="text-gray-700 hover:text-red-400 text-sm transition-colors">🗑</button>
                </div>
              </div>
              <p className="text-xs text-gray-600 mt-1.5">{cat?.emoji} {cat?.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
