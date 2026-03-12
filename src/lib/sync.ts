/**
 * Supabase sync helpers.
 * Each function tries to write to Supabase; if unavailable it silently no-ops.
 * localStorage is always written first (offline-first guarantee).
 */

import { supabase } from './supabase';
import type { Skill, Motivation, Session } from '../types';

// ── Skills ────────────────────────────────────────────────────────────────

export async function syncSkillUpsert(skill: Skill): Promise<void> {
  if (!supabase) return;
  const { sub_skills, ...skillRow } = skill;
  await supabase.from('skills').upsert(skillRow);

  for (const ss of sub_skills) {
    const { drills, ...ssRow } = ss;
    await supabase.from('sub_skills').upsert(ssRow);
    for (const d of drills) {
      await supabase.from('drills').upsert(d);
    }
  }
}

export async function syncSkillDelete(skillId: string): Promise<void> {
  if (!supabase) return;
  await supabase.from('skills').delete().eq('id', skillId);
}

// ── Motivations ───────────────────────────────────────────────────────────

export async function syncMotivationUpsert(m: Motivation): Promise<void> {
  if (!supabase) return;
  await supabase.from('motivations').upsert(m);
}

export async function syncMotivationDelete(id: string): Promise<void> {
  if (!supabase) return;
  await supabase.from('motivations').delete().eq('id', id);
}

// ── Sessions ──────────────────────────────────────────────────────────────

export async function syncSessionSave(session: Session): Promise<void> {
  if (!supabase) return;
  const { drill_logs, ...sessionRow } = session;
  await supabase.from('sessions').upsert(sessionRow);

  const logRows = drill_logs.map(l => ({
    id: Math.random().toString(36).slice(2),
    session_id: session.id,
    drill_id: l.drill_id,
    drill_name: l.drill_name,
    duration_actual_secs: l.duration_actual_secs,
    reps_completed: l.reps_completed,
    zone_ratings: l.zone_ratings,
  }));
  if (logRows.length > 0) {
    await supabase.from('session_drill_logs').upsert(logRows);
  }
}

// ── Auth helpers ──────────────────────────────────────────────────────────

export async function getCurrentUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}
