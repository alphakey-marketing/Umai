/**
 * localStorage helpers for Japanese shadowing data.
 * Follows same pattern as storage.ts — offline-first, Supabase-ready later.
 */

import type { ShadowingSession, VaultEntry, DailyStreak } from '../types';

const KEYS = {
  shadowSessions: 'umai_shadow_sessions',
  vault:          'umai_vault',
  streaks:        'umai_streaks',
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

// ── Shadowing Sessions ────────────────────────────────────────────────────

export function getShadowSessions(): ShadowingSession[] {
  return read<ShadowingSession[]>(KEYS.shadowSessions, []);
}

export function saveShadowSession(session: ShadowingSession): void {
  const all = getShadowSessions();
  const idx = all.findIndex(s => s.id === session.id);
  if (idx >= 0) all[idx] = session;
  else all.unshift(session);
  write(KEYS.shadowSessions, all);
}

export function getLatestShadowSession(): ShadowingSession | null {
  const all = getShadowSessions();
  return all.length > 0 ? all[0] : null;
}

export function getTotalSentencesShadowed(): number {
  return getShadowSessions().reduce((sum, s) => sum + s.sentences_completed, 0);
}

export function getTotalShadowMinutes(): number {
  return getShadowSessions().reduce((sum, s) => {
    if (!s.ended_at) return sum;
    const diffMs = new Date(s.ended_at).getTime() - new Date(s.started_at).getTime();
    return sum + Math.round(diffMs / 60000);
  }, 0);
}

// ── Vocabulary Vault ──────────────────────────────────────────────────────

export function getVaultEntries(): VaultEntry[] {
  return read<VaultEntry[]>(KEYS.vault, []);
}

export function saveVaultEntry(entry: VaultEntry): void {
  const all = getVaultEntries();
  const idx = all.findIndex(e => e.id === entry.id);
  if (idx >= 0) all[idx] = entry;
  else all.unshift(entry);
  write(KEYS.vault, all);
}

export function deleteVaultEntry(id: string): void {
  write(KEYS.vault, getVaultEntries().filter(e => e.id !== id));
}

export function getVaultByAnime(animeId: string): VaultEntry[] {
  return getVaultEntries().filter(e => e.source_anime === animeId);
}

// ── Daily Streaks ─────────────────────────────────────────────────────────

export function getStreaks(): DailyStreak[] {
  return read<DailyStreak[]>(KEYS.streaks, []);
}

export function recordTodayActivity(sentences: number, minutes: number): void {
  const today = new Date().toISOString().split('T')[0];
  const all = getStreaks();
  const idx = all.findIndex(s => s.date === today);
  if (idx >= 0) {
    all[idx].sessions_count += 1;
    all[idx].sentences_shadowed += sentences;
    all[idx].minutes_practiced += minutes;
  } else {
    all.unshift({ date: today, sessions_count: 1, sentences_shadowed: sentences, minutes_practiced: minutes });
  }
  write(KEYS.streaks, all);
}

export function getCurrentStreak(): number {
  const streaks = getStreaks();
  if (streaks.length === 0) return 0;
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    if (streaks.find(s => s.date === dateStr)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  return streak;
}
