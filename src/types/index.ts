// ─── Core domain types ────────────────────────────────────────────────────

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

// ─── Session types (Phase 2) ──────────────────────────────────────────────

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
  focus_score: number; // % of zone_ratings that are 'learning'
}

// ─── Skill template (public, pre-seeded) ─────────────────────────────────

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

// ─── Auth / user ─────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  display_name: string;
  created_at: string;
}
