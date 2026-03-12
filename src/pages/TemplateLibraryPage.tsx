import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ANIME_LIBRARY } from '../data/animeLibrary';
import type { JLPTLevel, AnimeTag } from '../types';

const LEVELS: JLPTLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];
const TAGS: AnimeTag[] = ['日常会話', '推理', '料理', '自然', '学校', 'ファンタジー', 'スポーツ', '歴史'];

export default function TemplateLibraryPage() {
  const [levelFilter, setLevelFilter] = useState<JLPTLevel | 'ALL'>('ALL');
  const [tagFilter, setTagFilter]     = useState<AnimeTag | 'ALL'>('ALL');

  const filtered = ANIME_LIBRARY.filter(a => {
    const levelOk = levelFilter === 'ALL' || a.jlpt_level === levelFilter;
    const tagOk   = tagFilter === 'ALL' || a.tags.includes(tagFilter);
    return levelOk && tagOk;
  });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-black">🎬 Anime Library</h1>
        <p className="text-sm text-gray-400">Browse titles by JLPT level or topic. Pick an episode to start shadowing.</p>
      </header>

      {/* Level filter */}
      <div className="flex gap-2 flex-wrap">
        {(['ALL', ...LEVELS] as const).map(l => (
          <button
            key={l}
            onClick={() => setLevelFilter(l)}
            className={`text-xs px-3 py-1.5 rounded-full border font-bold transition-colors ${
              levelFilter === l
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-indigo-600'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Tag filter */}
      <div className="flex gap-2 flex-wrap">
        {(['ALL', ...TAGS] as const).map(t => (
          <button
            key={t}
            onClick={() => setTagFilter(t as AnimeTag | 'ALL')}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              tagFilter === t
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-indigo-600'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Results */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <p className="text-gray-500 text-sm">No anime match these filters.</p>
        )}
        {filtered.map(anime => (
          <div key={anime.id} className="rounded-2xl bg-gray-800 p-4 space-y-3">
            <div className="flex items-start gap-4">
              <span className="text-4xl">{anime.cover_emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-bold text-base">{anime.title}</h2>
                  <JLPTBadge level={anime.jlpt_level} />
                </div>
                <p className="text-xs text-gray-400">{anime.title_en} · {anime.episode_count} episodes</p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{anime.description}</p>
                <div className="flex gap-1 flex-wrap mt-2">
                  {anime.tags.map(tag => (
                    <span key={tag} className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Link
                to={`/session?anime=${anime.id}&episode=1`}
                className="text-center text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-xl transition-colors"
              >
                ▶ Start Ep.1
              </Link>
              <Link
                to={`/session?anime=${anime.id}`}
                className="text-center text-sm font-bold bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-xl transition-colors"
              >
                Choose Episode
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function JLPTBadge({ level }: { level: string }) {
  const colours: Record<string, string> = {
    N5: 'bg-green-900/60 text-green-400 border-green-800',
    N4: 'bg-blue-900/60 text-blue-400 border-blue-800',
    N3: 'bg-yellow-900/60 text-yellow-400 border-yellow-800',
    N2: 'bg-orange-900/60 text-orange-400 border-orange-800',
    N1: 'bg-red-900/60 text-red-400 border-red-800',
  };
  return (
    <span className={`text-xs border px-2 py-0.5 rounded-full font-bold ${colours[level] ?? 'bg-gray-800 text-gray-400'}`}>
      {level}
    </span>
  );
}
