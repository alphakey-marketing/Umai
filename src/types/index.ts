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
