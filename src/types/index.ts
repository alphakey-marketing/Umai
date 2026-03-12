// ─── Preserved from original Umai (used by existing pages/storage) ────────

export interface Drill {
  id: string;
  sub_skill_id: string;
  name: string;
  description: string;
  duration_secs: number;
  target_reps: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
}

export interface SubSkill {
  id: string;
  skill_id: string;
  name: string;
  description: string;
  order_index: number;
  drills: Drill[];
}

export interface Skill {
  id: string;
  user_id: string;
  name: string;
  category: string;
  icon: string;
  created_at: string;
  sub_skills: SubSkill[];
}

export interface Motivation {
  id: string;
  user_id: string;
  statement: string;
  is_favourite: boolean;
  category: 'prove_them_wrong' | 'future_self' | 'why_i_started' | 'battle_cry';
  created_at: string;
}

export type ZoneRating = 'comfort' | 'learning' | 'panic';

export interface DrillLog {
  drill_id: string;
  drill_name: string;
  duration_actual_secs: number;
  reps_completed: number;
  zone_ratings: ZoneRating[];
}

export interface Session {
  id: string;
  user_id: string;
  skill_id: string;
  skill_name: string;
  skill_icon: string;
  started_at: string;
  ended_at: string;
  drill_logs: DrillLog[];
  overall_rating: 1 | 2 | 3 | 4 | 5;
  went_well: string;
  improve_next: string;
  focus_score: number;
}

export interface AIDrillSuggestion {
  name: string;
  description: string;
  duration_secs: number;
  target_reps: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  reasoning: string;
}

export interface DrillTemplate {
  name: string;
  description: string;
  duration_secs: number;
  target_reps: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
}

export interface SubSkillTemplate {
  name: string;
  description: string;
  drills: DrillTemplate[];
}

export interface SkillTemplate {
  id: string;
  name: string;
  category: string;
  icon: string;
  description: string;
  sub_skills: SubSkillTemplate[];
}

export interface UserProfile {
  id: string;
  display_name: string;
  created_at: string;
}

// ─── Japanese Shadowing Types (Phase 1+) ──────────────────────────────────

export type JLPTLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';

export type AnimeTag =
  | '日常会話'
  | '推理'
  | '料理'
  | '自然'
  | '学校'
  | 'ファンタジー'
  | 'スポーツ'
  | '歴史';

export interface AnimeEpisode {
  id: string;
  anime_id: string;
  episode_number: number;
  title: string;           // Japanese title
  title_en: string;        // English title
  duration_secs: number;
  has_srt: boolean;        // whether a bundled SRT is available
}

export interface AnimeTitle {
  id: string;
  title: string;           // Japanese title e.g. 「しろくまカフェ」
  title_en: string;        // English e.g. "Polar Bear Café"
  jlpt_level: JLPTLevel;
  tags: AnimeTag[];
  episode_count: number;
  description: string;
  cover_emoji: string;     // placeholder until real cover images are added
  episodes: AnimeEpisode[];
}

// ─── Subtitle / Shadowing types ───────────────────────────────────────────

export interface SubtitleLine {
  index: number;
  start_ms: number;        // milliseconds
  end_ms: number;
  text: string;            // raw Japanese text
}

export type ShadowingMode = 'watch' | 'shadow' | 'dictation';

export interface ShadowingSession {
  id: string;
  user_id: string;
  anime_id: string;
  anime_title: string;
  episode_id: string;
  episode_number: number;
  mode: ShadowingMode;
  started_at: string;
  ended_at: string | null;
  sentences_total: number;
  sentences_completed: number;
  sentences_saved: number;  // saved to vault
  self_rating: 1 | 2 | 3 | 4 | 5 | null;
}

// ─── Vocabulary Vault types ───────────────────────────────────────────────

export interface VaultEntry {
  id: string;
  user_id: string;
  japanese: string;        // full sentence from subtitle
  reading: string;         // furigana / reading hint (optional, user can fill)
  meaning: string;         // user's own note / meaning
  source_anime: string;
  source_episode: number;
  source_timestamp_ms: number;
  tags: string[];          // e.g. ['て-form', 'N3', '日常会話']
  created_at: string;
  review_count: number;
  last_reviewed_at: string | null;
}

// ─── Progress / streak types ──────────────────────────────────────────────

export interface DailyStreak {
  date: string;            // ISO date 'YYYY-MM-DD'
  sessions_count: number;
  sentences_shadowed: number;
  minutes_practiced: number;
}
