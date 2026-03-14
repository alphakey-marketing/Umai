import { useEffect, useRef, useState, useCallback } from 'react';
import type { SubtitleLine, VaultEntry } from '../types';
import { getActiveLine } from '../lib/subtitleParser';
import { saveVaultEntry } from '../lib/shadowStorage';

interface Props {
  lines: SubtitleLine[];
  currentMs: number;
  animeId: string;
  animeName: string;
  episodeNumber: number;
  videoRef: React.RefObject<HTMLVideoElement>;
  mode: 'watch' | 'shadow' | 'dictation';
  /** Hard cap on shadow pause duration in ms. Comes from settings.shadow_pause_cap_ms. */
  pauseCapMs?: number;
  onSentenceComplete?: (line: SubtitleLine) => void;
  onSaved?: (entry: VaultEntry) => void;
}

/**
 * Pause duration for shadow mode.
 * lineDuration + max(charCount × 130ms, 2000ms) + 800ms, capped at pauseCapMs.
 */
function shadowPauseMs(line: SubtitleLine, capMs: number): number {
  const lineDuration = line.end_ms - line.start_ms;
  const charCount    = line.text.replace(/\s/g, '').length;
  const repeatMs     = Math.max(charCount * 130, 2000);
  return Math.min(lineDuration + repeatMs + 800, capMs);
}

export default function SubtitlePlayer({
  lines, currentMs, animeId, animeName, episodeNumber,
  videoRef, mode,
  pauseCapMs = 12000,
  onSentenceComplete, onSaved,
}: Props) {
  const activeLine          = getActiveLine(lines, currentMs);
  const [hidden, setHidden] = useState(mode === 'dictation');
  const [savedId, setSavedId]       = useState<number | null>(null);
  const [toast, setToast]           = useState<string | null>(null);
  // countdown: ms remaining in the current shadow pause (null = not paused)
  const [countdown, setCountdown]   = useState<number | null>(null);
  const prevLineRef                 = useRef<SubtitleLine | null>(null);
  const shadowPausedRef             = useRef(false);
  const resumeTimerRef              = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  // Keep a stable ref to activeLine so keyboard handler can read it without
  // being in the dependency array (avoids re-registering keydown every tick)
  const activeLineRef               = useRef<SubtitleLine | null>(null);
  activeLineRef.current             = activeLine;

  // Helper: stop the live countdown ticker
  const clearCountdown = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdown(null);
  }, []);

  // Helper: start a fresh pause + countdown for a given line.
  // Used both by the auto-pause effect and by the R-key replay handler.
  const startShadowPause = useCallback((line: SubtitleLine) => {
    if (!videoRef.current) return;

    // Cancel any currently running timer/countdown first
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
    clearCountdown();

    videoRef.current.pause();
    shadowPausedRef.current = true;

    const totalMs = shadowPauseMs(line, pauseCapMs);

    // Start the live countdown ticker (100ms resolution for smooth display)
    let remaining = totalMs;
    setCountdown(remaining);
    countdownIntervalRef.current = setInterval(() => {
      remaining -= 100;
      if (remaining <= 0) {
        clearCountdown();
      } else {
        setCountdown(remaining);
      }
    }, 100);

    resumeTimerRef.current = setTimeout(() => {
      resumeTimerRef.current = null;
      clearCountdown();
      if (videoRef.current) videoRef.current.play();
      shadowPausedRef.current = false;
      onSentenceComplete?.(line);
    }, totalMs);
  }, [videoRef, pauseCapMs, clearCountdown, onSentenceComplete]);

  // Shadow mode: auto-pause on new line.
  //
  // We always clear any running timer when activeLine changes (including on
  // manual seeks). This prevents a stale timer from an old line firing and
  // resuming playback at the wrong moment.
  useEffect(() => {
    if (mode !== 'shadow') return;

    // Always cancel pending auto-resume + countdown when the active line changes.
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
    clearCountdown();

    if (!activeLine) return;

    // Same line index as before — nothing to do.
    if (prevLineRef.current?.index === activeLine.index) return;
    prevLineRef.current = activeLine;

    // Reset the pause guard so this new line always triggers a fresh pause.
    shadowPausedRef.current = false;

    startShadowPause(activeLine);
  }, [activeLine, mode, clearCountdown, startShadowPause]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;

      switch (e.key.toLowerCase()) {
        case ' ':   // Space — manual pause/resume
        case 'p': {
          e.preventDefault();
          if (!videoRef.current) break;
          if (videoRef.current.paused) {
            // Cancel auto-timer so user controls resume
            if (resumeTimerRef.current) {
              clearTimeout(resumeTimerRef.current);
              resumeTimerRef.current = null;
            }
            clearCountdown();
            shadowPausedRef.current = false;
            videoRef.current.play();
          } else {
            videoRef.current.pause();
            shadowPausedRef.current = true;
          }
          break;
        }
        case 'h': setHidden(h => !h); break;
        case 'r': {
          // FIX: Replay resets the video to line start AND restarts the full
          // shadow pause + countdown from scratch for the same line. Previously
          // the old countdown kept running (stale display) while the video
          // replayed from the beginning of the line.
          const line = activeLineRef.current;
          if (line && videoRef.current) {
            videoRef.current.currentTime = line.start_ms / 1000;
            // Don't auto-play here — startShadowPause will pause immediately
            // and begin a fresh countdown. The video plays when the timer fires.
            // We also need to reset prevLineRef so the effect doesn't skip this
            // line when activeLine hasn't changed index.
            prevLineRef.current = null;
            startShadowPause(line);
          }
          break;
        }
        case 's':
          if (activeLineRef.current) saveToVault(activeLineRef.current);
          break;
        case 'arrowleft':
          if (videoRef.current) videoRef.current.currentTime -= 5;
          break;
        case 'arrowright':
          if (videoRef.current) videoRef.current.currentTime += 5;
          break;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // Only depends on stable refs/callbacks — no re-registration every tick
  }, [videoRef, clearCountdown, startShadowPause]);

  function saveToVault(line: SubtitleLine) {
    if (savedId === line.index) return;
    const entry: VaultEntry = {
      id:                  `vault_${Date.now()}_${line.index}`,
      user_id:             'guest',
      japanese:            line.text,
      reading:             '',
      meaning:             '',
      source_anime:        animeId,
      source_episode:      episodeNumber,
      source_timestamp_ms: line.start_ms,
      tags:                [],
      created_at:          new Date().toISOString(),
      review_count:        0,
      last_reviewed_at:    null,
    };
    saveVaultEntry(entry);
    setSavedId(line.index);
    showToast('📚 Saved to vault!');
    onSaved?.(entry);
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }

  function replayLine() {
    const line = activeLineRef.current;
    if (line && videoRef.current) {
      videoRef.current.currentTime = line.start_ms / 1000;
      prevLineRef.current = null;
      startShadowPause(line);
    }
  }

  // Derived values for countdown bar display
  const isCountingDown  = countdown !== null && activeLine !== null;
  const totalPauseMs    = activeLine ? shadowPauseMs(activeLine, pauseCapMs) : 1;
  const countdownSec    = countdown !== null ? (countdown / 1000).toFixed(1) : null;
  const barPct          = isCountingDown ? Math.max(0, (countdown! / totalPauseMs) * 100) : 0;

  return (
    <div className="relative">
      {toast && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap z-10">
          {toast}
        </div>
      )}

      <div className="rounded-2xl bg-gray-900 border border-gray-800 p-4 min-h-[80px] flex flex-col gap-3">
        {/* Subtitle text */}
        <div className="text-center">
          {activeLine ? (
            hidden ? (
              <button onClick={() => setHidden(false)} className="text-sm text-gray-500 italic underline">
                Tap to reveal subtitle
              </button>
            ) : (
              <p className="text-lg font-bold leading-relaxed text-white">{activeLine.text}</p>
            )
          ) : (
            <p className="text-sm text-gray-600 italic">...</p>
          )}
        </div>

        {/* Live countdown bar — only visible during a shadow pause */}
        {isCountingDown && (
          <div className="space-y-1">
            <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-none"
                style={{ width: `${barPct}%` }}
              />
            </div>
            <p className="text-xs text-indigo-400 font-bold text-center tabular-nums">
              ⏱ {countdownSec}s · shadow now
            </p>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <ControlBtn onClick={replayLine}          title="Replay (R)"           emoji="🔁" />
            <ControlBtn
              onClick={() => setHidden(h => !h)}
              title="Hide/show subtitle (H)"
              emoji={hidden ? '👁️' : '🚫'}
              active={hidden}
            />
          </div>
          {activeLine && (
            <button
              onClick={() => saveToVault(activeLine)}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border transition-colors ${
                savedId === activeLine.index
                  ? 'bg-indigo-900/60 border-indigo-700 text-indigo-400'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-indigo-500 hover:text-indigo-300'
              }`}
            >
              <span>{savedId === activeLine.index ? '✓' : '📚'}</span>
              {savedId === activeLine.index ? 'Saved' : 'Save (S)'}
            </button>
          )}
        </div>

        {/* Mode badge + hint */}
        <div className="flex items-center justify-between">
          <ModeBadge mode={mode} />
          {mode === 'shadow' && !isCountingDown && activeLine ? (
            <p className="text-xs text-gray-600">⏱ up to {(pauseCapMs / 1000).toFixed(0)}s · Space to pause</p>
          ) : mode !== 'shadow' ? (
            <p className="text-xs text-gray-600">Space · pause &nbsp;·&nbsp; R · replay &nbsp;·&nbsp; S · save</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ControlBtn({ onClick, title, emoji, active = false }: {
  onClick: () => void; title: string; emoji: string; active?: boolean;
}) {
  return (
    <button onClick={onClick} title={title}
      className={`text-xl px-2 py-1 rounded-lg transition-colors ${
        active ? 'bg-indigo-900/50 text-indigo-300' : 'hover:bg-gray-800 text-gray-400'
      }`}>
      {emoji}
    </button>
  );
}

function ModeBadge({ mode }: { mode: string }) {
  const styles: Record<string, string> = {
    watch: 'bg-gray-800 text-gray-400',
    shadow: 'bg-indigo-900/60 text-indigo-400',
    dictation: 'bg-purple-900/60 text-purple-400',
  };
  const labels: Record<string, string> = {
    watch: '👀 Watch', shadow: '🗣️ Shadow', dictation: '✏️ Dictation',
  };
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${styles[mode] ?? styles.watch}`}>
      {labels[mode] ?? mode}
    </span>
  );
}
