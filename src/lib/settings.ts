/**
 * settings.ts — persisted user preferences (localStorage)
 */

export type WhisperModel = 'Xenova/whisper-tiny' | 'Xenova/whisper-small' | 'Xenova/whisper-medium';
export type JLPTGoal   = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
export type AppTheme   = 'dark';

export interface UserSettings {
  // Onboarding
  onboarded:          boolean;
  display_name:       string;
  jlpt_goal:          JLPTGoal;

  // Transcription
  whisper_model:      WhisperModel;

  // Session behaviour
  /**
   * How many ms AFTER a line's start_ms the video pauses so the user
   * can shadow. 2000 = shadow 2 s after speaker starts (easiest),
   * 1000 = 1 s (medium), 500 = 0.5 s (hardest / near-simultaneous).
   */
  shadow_delay_ms:        number;
  shadow_pause_cap_ms:    number;   // maximum shadow speaking window (default 12000)
  auto_advance:           boolean;
  show_romaji:            boolean;
  line_complete_sound:    boolean;
  data_export_format:     'anki' | 'csv' | 'json';
}

const DEFAULTS: UserSettings = {
  onboarded:             false,
  display_name:          '',
  jlpt_goal:             'N4',
  whisper_model:         'Xenova/whisper-small',
  shadow_delay_ms:       2000,
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
