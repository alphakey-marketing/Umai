/**
 * SettingsContext — global UserSettings available via useSettings().
 */
import React, { createContext, useContext, useState, useCallback } from 'react';
import { loadSettings, saveSettings } from './settings';
import type { UserSettings } from './settings';

interface SettingsCtx {
  settings: UserSettings;
  update:   (patch: Partial<UserSettings>) => void;
}

const Ctx = createContext<SettingsCtx | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<UserSettings>(loadSettings);

  const update = useCallback((patch: Partial<UserSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  return <Ctx.Provider value={{ settings, update }}>{children}</Ctx.Provider>;
}

export function useSettings(): SettingsCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}
