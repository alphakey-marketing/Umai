/**
 * settings.ts — persisted user preferences (localStorage)
 *
 * All settings are typed, defaulted, and read/written atomically.
 * Components consume these via the useSettings() hook (SettingsContext).
 */

export type WhisperModel = 'Xenova/whisper-tiny' | 'Xenova/whisper-small' | 'Xenova/whisper-medium';
export type JLPTGoal   = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
export type AppTheme   = 'dark'; // light theme reserved for future

export interface UserSettings {
  // Onboarding
  onboarded:          boolean;
  display_name:       string;
  jlpt_goal:          JLPTGoal;

  // Transcription
  whisper_model:      WhisperModel;

  // Session behaviour
  shadow_pause_extra_ms:  number;   // extra ms added after auto-pause (default 2000)
  shadow_pause_cap_ms:    number;   // maximum shadow pause duration (default 12000)
  auto_advance:           boolean;  // auto-advance after pause timer (default false)
  show_romaji:            boolean;  // show romaji below Japanese text (default false)

  // Notifications / sound
  line_complete_sound:    boolean;  // play a soft chime on line complete (default true)

  // Data
  data_export_format:     'anki' | 'csv' | 'json';
}

const DEFAULTS: UserSettings = {
  onboarded:             false,
  display_name:          '',
  jlpt_goal:             'N4',
  whisper_model:         'Xenova/whisper-small',
  shadow_pause_extra_ms: 2000,
  shadow_pause_cap_ms:   12000,
  auto_advance:          false,
  show_romaji:           false,
  line_complete_sound:   true,
  data_export_format:    'anki',
};

const KEY = 'umai_settings';

export function loadSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    // Merge stored with defaults so new fields always have a value
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: UserSettings): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function patchSettings(patch: Partial<UserSettings>): UserSettings {
  const current = loadSettings();
  const next    = { ...current, ...patch };
  saveSettings(next);
  return next;
}
