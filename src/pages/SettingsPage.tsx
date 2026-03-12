import { useState } from 'react';
import { useSettings } from '../lib/settingsContext';
import {
  getShadowSessions,
  getVaultEntries,
  getStreaks,
} from '../lib/shadowStorage';
import { downloadAnkiTSV } from '../lib/ankiExport';
import type { WhisperModel, JLPTGoal } from '../lib/settings';

const WHISPER_MODELS: { value: WhisperModel; label: string; size: string; quality: string }[] = [
  {
    value:   'Xenova/whisper-tiny',
    label:   'Whisper Tiny',
    size:    '~77 MB',
    quality: 'Fast, lower accuracy — good for simple/clear audio',
  },
  {
    value:   'Xenova/whisper-small',
    label:   'Whisper Small',
    size:    '~244 MB',
    quality: 'Balanced — recommended for most anime',
  },
  {
    value:   'Xenova/whisper-medium',
    label:   'Whisper Medium',
    size:    '~769 MB',
    quality: 'Best accuracy — slower first load, great for fast speech',
  },
];

const JLPT_LEVELS: JLPTGoal[] = ['N5', 'N4', 'N3', 'N2', 'N1'];

export default function SettingsPage() {
  const { settings, update } = useSettings();
  const [saved, setSaved]    = useState(false);
  const [showDanger, setShowDanger] = useState(false);

  function flash() {
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  function handleClearData() {
    if (!confirm('Delete ALL shadowing sessions, vault entries, and streak data? This cannot be undone.')) return;
    localStorage.removeItem('umai_shadow_sessions');
    localStorage.removeItem('umai_vault');
    localStorage.removeItem('umai_streaks');
    alert('Data cleared.');
  }

  function handleExportJSON() {
    const data = {
      sessions: getShadowSessions(),
      vault:    getVaultEntries(),
      streaks:  getStreaks(),
      settings,
      exported_at: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `umai-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleExportAnki() {
    downloadAnkiTSV(getVaultEntries());
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black">⚙️ Settings</h1>
        <p className="text-gray-400 text-sm mt-1">Preferences, transcription model, and data controls.</p>
      </div>

      {/* Profile */}
      <Section title="👤 Profile">
        <Field label="Display name">
          <input
            type="text"
            value={settings.display_name}
            onChange={e => update({ display_name: e.target.value })}
            onBlur={flash}
            placeholder="Your name"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
          />
        </Field>
        <Field label="JLPT Goal" hint="Used for anime recommendations">
          <div className="flex gap-2 flex-wrap">
            {JLPT_LEVELS.map(level => (
              <button
                key={level}
                onClick={() => { update({ jlpt_goal: level }); flash(); }}
                className={`px-4 py-2 rounded-xl border-2 font-bold text-sm transition-all ${
                  settings.jlpt_goal === level
                    ? 'border-indigo-500 bg-indigo-950/40 text-indigo-300'
                    : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </Field>
      </Section>

      {/* Transcription */}
      <Section title="🧠 Transcription Model">
        <p className="text-xs text-gray-500 -mt-1 mb-3">
          Runs 100% in your browser. Downloaded once, cached forever. Larger = better Japanese accuracy.
        </p>
        <div className="space-y-2">
          {WHISPER_MODELS.map(m => (
            <button
              key={m.value}
              onClick={() => { update({ whisper_model: m.value }); flash(); }}
              className={`w-full flex items-start gap-4 rounded-2xl border-2 px-4 py-3 text-left transition-all ${
                settings.whisper_model === m.value
                  ? 'border-indigo-500 bg-indigo-950/30'
                  : 'border-gray-700 bg-gray-900 hover:border-gray-600'
              }`}
            >
              <div className="flex-1">
                <p className="font-bold text-sm">{m.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{m.quality}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-gray-500">{m.size}</p>
                {settings.whisper_model === m.value && (
                  <p className="text-xs text-indigo-400 font-bold mt-0.5">Active ✔</p>
                )}
              </div>
            </button>
          ))}
        </div>
        <p className="text-xs text-indigo-400 mt-2">
          💡 Changing model only takes effect on the next transcription. Cached models are instant.
        </p>
      </Section>

      {/* Session behaviour */}
      <Section title="🎬 Session Behaviour">
        <Field label="Extra pause after each line" hint="How long Umai waits before you can advance">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0} max={6000} step={500}
              value={settings.shadow_pause_extra_ms}
              onChange={e => update({ shadow_pause_extra_ms: Number(e.target.value) })}
              onMouseUp={flash}
              onTouchEnd={flash}
              className="flex-1 accent-indigo-500"
            />
            <span className="text-sm font-bold w-16 text-right">
              {settings.shadow_pause_extra_ms === 0 ? 'Off' : `${settings.shadow_pause_extra_ms / 1000}s`}
            </span>
          </div>
        </Field>

        <Toggle
          label="Auto-advance after pause"
          hint="Automatically play the next line after the pause timer. Good for watch mode."
          value={settings.auto_advance}
          onChange={v => { update({ auto_advance: v }); flash(); }}
        />

        <Toggle
          label="Show rōmaji"
          hint="Display rōmaji below Japanese subtitle text"
          value={settings.show_romaji}
          onChange={v => { update({ show_romaji: v }); flash(); }}
        />

        <Toggle
          label="Line complete sound"
          hint="Play a soft chime when a shadow line is marked complete"
          value={settings.line_complete_sound}
          onChange={v => { update({ line_complete_sound: v }); flash(); }}
        />
      </Section>

      {/* Data */}
      <Section title="💾 Data & Export">
        <div className="space-y-2">
          <button
            onClick={handleExportAnki}
            className="w-full flex items-center justify-between bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl px-4 py-3 transition-colors"
          >
            <div>
              <p className="text-sm font-bold">⬇️ Export Vault → Anki</p>
              <p className="text-xs text-gray-400">Tab-separated .txt ready for Anki import</p>
            </div>
            <span className="text-gray-500">›</span>
          </button>
          <button
            onClick={handleExportJSON}
            className="w-full flex items-center justify-between bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl px-4 py-3 transition-colors"
          >
            <div>
              <p className="text-sm font-bold">📦 Full Backup (JSON)</p>
              <p className="text-xs text-gray-400">Sessions, vault, streaks, and settings</p>
            </div>
            <span className="text-gray-500">›</span>
          </button>
        </div>
      </Section>

      {/* Danger zone */}
      <Section title="⚠️ Danger Zone">
        {!showDanger ? (
          <button
            onClick={() => setShowDanger(true)}
            className="text-sm text-red-500 hover:text-red-400 underline"
          >
            Show danger options
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-400">These actions are irreversible. Export a backup first.</p>
            <button
              onClick={handleClearData}
              className="w-full bg-red-900/30 hover:bg-red-900/50 border border-red-800 text-red-400 font-bold text-sm py-3 rounded-xl transition-colors"
            >
              🗑 Clear All Shadowing Data
            </button>
          </div>
        )}
      </Section>

      {/* Re-run onboarding */}
      <Section title="🍣 Onboarding">
        <button
          onClick={() => update({ onboarded: false })}
          className="text-sm text-indigo-400 hover:underline"
        >
          Re-run onboarding wizard
        </button>
      </Section>

      {/* Save flash */}
      {saved && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg animate-fade-in">
          ✔ Saved
        </div>
      )}
    </div>
  );
}

// ── sub-components ─────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <p className="text-xs font-bold uppercase tracking-widest text-indigo-400">{title}</p>
      {children}
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        {hint && <p className="text-xs text-gray-500">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Toggle({
  label, hint, value, onChange,
}: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <p className="text-sm font-semibold">{label}</p>
        {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
      </div>
      <button
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative shrink-0 w-12 h-6 rounded-full transition-colors ${
          value ? 'bg-indigo-600' : 'bg-gray-700'
        }`}
      >
        <span
          className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            value ? 'translate-x-6' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
