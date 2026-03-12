import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  getVaultEntries,
  saveVaultEntry,
  deleteVaultEntry,
} from '../lib/shadowStorage';
import { downloadAnkiTSV } from '../lib/ankiExport';
import { ANIME_LIBRARY } from '../data/animeLibrary';
import type { VaultEntry } from '../types';

type SortKey = 'newest' | 'oldest' | 'anime' | 'review';

export default function VaultPage() {
  const [entries, setEntries]       = useState<VaultEntry[]>(getVaultEntries);
  const [search, setSearch]         = useState('');
  const [animeFilter, setAnimeFilter] = useState<string>('ALL');
  const [sortKey, setSortKey]       = useState<SortKey>('newest');
  const [editing, setEditing]       = useState<string | null>(null); // entry id being edited
  const [editReading, setEditReading] = useState('');
  const [editMeaning, setEditMeaning] = useState('');
  const [editTags, setEditTags]       = useState('');

  function refresh() { setEntries(getVaultEntries()); }

  // Unique anime sources in vault
  const animeSources = useMemo(() => {
    const ids = [...new Set(entries.map(e => e.source_anime))];
    return ids.map(id => {
      const a = ANIME_LIBRARY.find(a => a.id === id);
      return { id, title: a?.title ?? id };
    });
  }, [entries]);

  const filtered = useMemo(() => {
    let list = [...entries];
    if (animeFilter !== 'ALL') list = list.filter(e => e.source_anime === animeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.japanese.toLowerCase().includes(q) ||
        e.meaning.toLowerCase().includes(q) ||
        e.reading.toLowerCase().includes(q) ||
        e.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    switch (sortKey) {
      case 'oldest':  list.sort((a, b) => a.created_at.localeCompare(b.created_at)); break;
      case 'anime':   list.sort((a, b) => a.source_anime.localeCompare(b.source_anime)); break;
      case 'review':  list.sort((a, b) => (a.last_reviewed_at ?? '').localeCompare(b.last_reviewed_at ?? '')); break;
      default:        list.sort((a, b) => b.created_at.localeCompare(a.created_at)); break;
    }
    return list;
  }, [entries, animeFilter, search, sortKey]);

  function startEdit(e: VaultEntry) {
    setEditing(e.id);
    setEditReading(e.reading);
    setEditMeaning(e.meaning);
    setEditTags(e.tags.join(', '));
  }

  function saveEdit(entry: VaultEntry) {
    saveVaultEntry({
      ...entry,
      reading: editReading.trim(),
      meaning: editMeaning.trim(),
      tags:    editTags.split(',').map(t => t.trim()).filter(Boolean),
    });
    setEditing(null);
    refresh();
  }

  function handleDelete(id: string) {
    deleteVaultEntry(id);
    refresh();
  }

  function handleReview(entry: VaultEntry) {
    saveVaultEntry({
      ...entry,
      review_count:    entry.review_count + 1,
      last_reviewed_at: new Date().toISOString(),
    });
    refresh();
  }

  function handleExport() {
    downloadAnkiTSV(filtered.length > 0 ? filtered : entries);
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-20 space-y-4">
        <p className="text-5xl">📚</p>
        <p className="font-bold">Vault is empty</p>
        <p className="text-gray-400 text-sm">
          Press <kbd className="bg-gray-800 border border-gray-700 rounded px-1 font-mono text-xs">S</kbd> during
          shadowing to save sentences here.
        </p>
        <Link
          to="/session"
          className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-lg"
        >
          Start Shadowing
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">📚 Vault</h1>
          <p className="text-gray-400 text-sm mt-0.5">{entries.length} saved sentence{entries.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 text-xs font-bold bg-indigo-700 hover:bg-indigo-600 text-white px-3 py-2 rounded-xl transition-colors"
        >
          ⬇️ Anki Export
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search sentences, meanings, tags…"
        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
      />

      {/* Filters row */}
      <div className="flex gap-2 flex-wrap items-center">
        {/* Anime filter */}
        <div className="flex gap-1 flex-wrap">
          <FilterChip active={animeFilter === 'ALL'} onClick={() => setAnimeFilter('ALL')}>All</FilterChip>
          {animeSources.map(a => (
            <FilterChip key={a.id} active={animeFilter === a.id} onClick={() => setAnimeFilter(a.id)}>
              {a.title}
            </FilterChip>
          ))}
        </div>

        {/* Sort */}
        <select
          value={sortKey}
          onChange={e => setSortKey(e.target.value as SortKey)}
          className="ml-auto text-xs bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-gray-300 focus:outline-none focus:border-indigo-500"
        >
          <option value="newest">↓ Newest</option>
          <option value="oldest">↑ Oldest</option>
          <option value="anime">🎬 Anime</option>
          <option value="review">🔄 Needs review</option>
        </select>
      </div>

      {/* Results count */}
      {search && (
        <p className="text-xs text-gray-500">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</p>
      )}

      {/* Entries */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <p className="text-center text-gray-600 py-8 text-sm">No entries match your search.</p>
        )}
        {filtered.map(entry => (
          <VaultCard
            key={entry.id}
            entry={entry}
            isEditing={editing === entry.id}
            editReading={editReading}
            editMeaning={editMeaning}
            editTags={editTags}
            onEdit={() => startEdit(entry)}
            onSaveEdit={() => saveEdit(entry)}
            onCancelEdit={() => setEditing(null)}
            onDelete={() => handleDelete(entry.id)}
            onReview={() => handleReview(entry)}
            setEditReading={setEditReading}
            setEditMeaning={setEditMeaning}
            setEditTags={setEditTags}
          />
        ))}
      </div>

      {/* Anki export hint */}
      <div className="rounded-xl bg-gray-900/50 border border-gray-800 p-4 text-xs text-gray-500 space-y-1">
        <p className="font-bold text-gray-400">🃴 Anki Export</p>
        <p>Exports as tab-separated .txt → Anki → File → Import. Front = Japanese sentence, Back = reading + meaning + source.</p>
        <p className="text-indigo-400">Filtered results only — use the anime filter to export by show.</p>
      </div>
    </div>
  );
}

function VaultCard({
  entry, isEditing,
  editReading, editMeaning, editTags,
  onEdit, onSaveEdit, onCancelEdit, onDelete, onReview,
  setEditReading, setEditMeaning, setEditTags,
}: {
  entry: VaultEntry;
  isEditing: boolean;
  editReading: string; editMeaning: string; editTags: string;
  onEdit: () => void; onSaveEdit: () => void; onCancelEdit: () => void;
  onDelete: () => void; onReview: () => void;
  setEditReading: (v: string) => void;
  setEditMeaning: (v: string) => void;
  setEditTags: (v: string) => void;
}) {
  const anime = ANIME_LIBRARY.find(a => a.id === entry.source_anime);
  const ts    = new Date(entry.created_at).toLocaleDateString('en-HK', { month: 'short', day: 'numeric' });
  const lastReviewed = entry.last_reviewed_at
    ? new Date(entry.last_reviewed_at).toLocaleDateString('en-HK', { month: 'short', day: 'numeric' })
    : null;

  return (
    <div className="rounded-2xl bg-gray-800 border border-gray-700 p-4 space-y-3">
      {/* Japanese sentence */}
      <p className="text-lg font-bold leading-relaxed">{entry.japanese}</p>

      {isEditing ? (
        <div className="space-y-2">
          <input
            type="text" value={editReading} onChange={e => setEditReading(e.target.value)}
            placeholder="Reading / furigana (optional)"
            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
          />
          <input
            type="text" value={editMeaning} onChange={e => setEditMeaning(e.target.value)}
            placeholder="Meaning / notes"
            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
          />
          <input
            type="text" value={editTags} onChange={e => setEditTags(e.target.value)}
            placeholder="Tags (comma-separated): N3, て-form, 日常会話"
            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
          />
          <div className="flex gap-2">
            <button onClick={onSaveEdit}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold py-1.5 rounded-lg transition-colors">
              Save
            </button>
            <button onClick={onCancelEdit}
              className="px-4 text-sm text-gray-400 hover:text-white">Cancel</button>
          </div>
        </div>
      ) : (
        <>
          {entry.reading && <p className="text-sm text-indigo-300">{entry.reading}</p>}
          {entry.meaning && <p className="text-sm text-gray-300">{entry.meaning}</p>}
          {entry.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {entry.tags.map(tag => (
                <span key={tag} className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">{tag}</span>
              ))}
            </div>
          )}
        </>
      )}

      {/* Meta row */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {anime?.cover_emoji} {anime?.title ?? entry.source_anime} Ep.{entry.source_episode} · {ts}
        </span>
        <span>
          {entry.review_count > 0 ? `🔄 ×${entry.review_count}${lastReviewed ? ` · ${lastReviewed}` : ''}` : 'Not reviewed'}
        </span>
      </div>

      {/* Action row */}
      {!isEditing && (
        <div className="flex gap-2">
          <button onClick={onReview}
            className="flex-1 text-xs font-bold bg-gray-700 hover:bg-gray-600 py-1.5 rounded-lg transition-colors">
            🔄 Reviewed
          </button>
          <button onClick={onEdit}
            className="flex-1 text-xs font-bold bg-gray-700 hover:bg-gray-600 py-1.5 rounded-lg transition-colors">
            ✏️ Edit
          </button>
          <button onClick={onDelete}
            className="text-xs text-gray-600 hover:text-red-400 px-3 transition-colors">
            🗑
          </button>
        </div>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
        active
          ? 'bg-indigo-600 border-indigo-500 text-white'
          : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-indigo-600'
      }`}
    >
      {children}
    </button>
  );
}
