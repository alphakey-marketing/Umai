import type { AnimeTitle } from '../types';

/**
 * Seed anime library — N4-N3 range, good for shadowing & daily Japanese.
 * Episodes list is illustrative; real episode metadata can be extended.
 */
export const ANIME_LIBRARY: AnimeTitle[] = [
  {
    id: 'shirokuma-cafe',
    title: 'しろくまカフェ',
    title_en: 'Polar Bear Café',
    jlpt_level: 'N4',
    tags: ['日常会話'],
    episode_count: 50,
    description:
      'A polar bear runs a café visited by a panda, penguin, and various animals. ' +
      'Clear speech, slow pace, perfect for N4-N3 daily conversation practice.',
    cover_emoji: '🐻‍❄️',
    episodes: Array.from({ length: 50 }, (_, i) => ({
      id: `shirokuma-cafe-ep${i + 1}`,
      anime_id: 'shirokuma-cafe',
      episode_number: i + 1,
      title: `第${i + 1}話`,
      title_en: `Episode ${i + 1}`,
      duration_secs: 780, // ~13 min
      has_srt: i === 0,   // Episode 1 has bundled SRT for demo
    })),
  },
  {
    id: 'yuru-camp',
    title: 'ゆるキャン△',
    title_en: 'Laid-Back Camp',
    jlpt_level: 'N3',
    tags: ['日常会話', '自然'],
    episode_count: 12,
    description:
      'Girls enjoy solo and group camping trips. Natural conversational Japanese, ' +
      'weather and food vocabulary. Ideal N3 listening practice.',
    cover_emoji: '⛺',
    episodes: Array.from({ length: 12 }, (_, i) => ({
      id: `yuru-camp-ep${i + 1}`,
      anime_id: 'yuru-camp',
      episode_number: i + 1,
      title: `第${i + 1}話`,
      title_en: `Episode ${i + 1}`,
      duration_secs: 1440, // ~24 min
      has_srt: false,
    })),
  },
  {
    id: 'amaama-inazuma',
    title: '甘々と稲妻',
    title_en: 'Sweetness and Lightning',
    jlpt_level: 'N3',
    tags: ['日常会話', '料理', '学校'],
    episode_count: 12,
    description:
      'A single father learns to cook with his student. Rich in kitchen vocabulary, ' +
      'family expressions and emotional Japanese.',
    cover_emoji: '🍳',
    episodes: Array.from({ length: 12 }, (_, i) => ({
      id: `amaama-ep${i + 1}`,
      anime_id: 'amaama-inazuma',
      episode_number: i + 1,
      title: `第${i + 1}話`,
      title_en: `Episode ${i + 1}`,
      duration_secs: 1440,
      has_srt: false,
    })),
  },
  {
    id: 'detective-conan',
    title: '名探偵コナン',
    title_en: 'Detective Conan',
    jlpt_level: 'N3',
    tags: ['日常会話', '推理'],
    episode_count: 1000,
    description:
      'A teenage detective shrunk to a child solves crimes. Clear natural speech, ' +
      'N2-N3 deduction vocabulary, great for intermediate learners.',
    cover_emoji: '🔍',
    episodes: Array.from({ length: 50 }, (_, i) => ({
      id: `conan-ep${i + 1}`,
      anime_id: 'detective-conan',
      episode_number: i + 1,
      title: `第${i + 1}話`,
      title_en: `Episode ${i + 1}`,
      duration_secs: 1440,
      has_srt: false,
    })),
  },
  {
    id: 'nichijou',
    title: '日常',
    title_en: 'Nichijou – My Ordinary Life',
    jlpt_level: 'N3',
    tags: ['日常会話', '学校'],
    episode_count: 26,
    description:
      'Absurd comedy set in high school with surreal gags. Varied speech styles ' +
      'including casual, excited, and deadpan — great for expression range.',
    cover_emoji: '🎒',
    episodes: Array.from({ length: 26 }, (_, i) => ({
      id: `nichijou-ep${i + 1}`,
      anime_id: 'nichijou',
      episode_number: i + 1,
      title: `第${i + 1}話`,
      title_en: `Episode ${i + 1}`,
      duration_secs: 1440,
      has_srt: false,
    })),
  },
];

export function getAnimeById(id: string): AnimeTitle | undefined {
  return ANIME_LIBRARY.find(a => a.id === id);
}

export function getAnimeByLevel(level: string): AnimeTitle[] {
  return ANIME_LIBRARY.filter(a => a.jlpt_level === level);
}

export function getAnimeByTag(tag: string): AnimeTitle[] {
  return ANIME_LIBRARY.filter(a => a.tags.includes(tag as never));
}
