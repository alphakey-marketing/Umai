/**
 * Offline-first localStorage helpers.
 * When Supabase is available and user is logged in, data is synced there.
 * In guest mode everything lives here.
 */

import type { Skill, Motivation, Session } from '../types';

const KEYS = {
  skills:      'umai_skills',
  motivations: 'umai_motivations',
  sessions:    'umai_sessions',
  guestId:     'umai_guest_id',
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

// ── Skills ────────────────────────────────────────────────────────────────

export function getLocalSkills(): Skill[] {
  return read<Skill[]>(KEYS.skills, []);
}

export function saveLocalSkills(skills: Skill[]): void {
  write(KEYS.skills, skills);
}

export function upsertLocalSkill(skill: Skill): void {
  const all = getLocalSkills();
  const idx = all.findIndex(s => s.id === skill.id);
  if (idx >= 0) all[idx] = skill;
  else all.push(skill);
  saveLocalSkills(all);
}

export function deleteLocalSkill(id: string): void {
  saveLocalSkills(getLocalSkills().filter(s => s.id !== id));
}

// ── Motivations ───────────────────────────────────────────────────────────

export function getLocalMotivations(): Motivation[] {
  return read<Motivation[]>(KEYS.motivations, []);
}

export function saveLocalMotivations(motivations: Motivation[]): void {
  write(KEYS.motivations, motivations);
}

export function upsertLocalMotivation(m: Motivation): void {
  const all = getLocalMotivations();
  const idx = all.findIndex(x => x.id === m.id);
  if (idx >= 0) all[idx] = m;
  else all.push(m);
  saveLocalMotivations(all);
}

export function deleteLocalMotivation(id: string): void {
  saveLocalMotivations(getLocalMotivations().filter(m => m.id !== id));
}

// ── Sessions ──────────────────────────────────────────────────────────────

export function getLocalSessions(): Session[] {
  return read<Session[]>(KEYS.sessions, []);
}

export function saveLocalSession(session: Session): void {
  const all = getLocalSessions();
  const idx = all.findIndex(s => s.id === session.id);
  if (idx >= 0) all[idx] = session;
  else all.unshift(session); // newest first
  write(KEYS.sessions, all);
}

export function getSessionsForSkill(skillId: string): Session[] {
  return getLocalSessions().filter(s => s.skill_id === skillId);
}

// ── Guest ID ──────────────────────────────────────────────────────────────

export function getOrCreateGuestId(): string {
  let id = localStorage.getItem(KEYS.guestId);
  if (!id) {
    id = 'guest_' + Math.random().toString(36).slice(2);
    localStorage.setItem(KEYS.guestId, id);
  }
  return id;
}
