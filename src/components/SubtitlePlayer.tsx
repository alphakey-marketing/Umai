import { useEffect, useRef, useState, useCallback } from 'react';
import type { SubtitleLine, VaultEntry } from '../types';
import { getActiveLine } from '../lib/subtitleParser';
import { saveVaultEntry } from '../lib/shadowStorage';

interface Props {
  lines:          SubtitleLine[];
  currentMs:      number;
  animeId:        string;
  animeName:      string;
  episodeNumber:  number;
  videoRef:       React.RefObject<HTMLVideoElement>;
  mode:           'watch' | 'shadow' | 'dictation';
  /** How many ms after line start_ms to pause (2000 / 1000 / 500). From settings. */
  shadowDelayMs?: number;
  /** Hard cap on the user's speaking window in ms. */
  pauseCapMs?:    number;
  onSentenceComplete?: (line: SubtitleLine) => void;
  onSaved?:            (entry: VaultEntry)  => void;
}

const DELAY_OPTIONS = [
  { label: '2s',   value: 2000, hint: 'Easy'   },
  { label: '1s',   value: 1000, hint: 'Medium'  },
  { label: '0.5s', value:  500, hint: 'Hard'    },
] as const;

/**
 * How long the user gets to speak after the video pauses.
 * Based purely on line length; the delay offset is handled separately.
 */
function speakingWindowMs(line: SubtitleLine, capMs: number): number {
  const charCount = line.text.replace(/\s/g, '').length;
  return Math.min(Math.max(charCount * 130, 2500), capMs);
}

export default function SubtitlePlayer({
  lines, currentMs, animeId, animeName, episodeNumber,
  videoRef, mode,
  shadowDelayMs: shadowDelayMsProp = 2000,
  pauseCapMs = 12000,
  onSentenceComplete, onSaved,
}: Props) {
  const activeLine = getActiveLine(lines, currentMs);

  // Live delay override — user can change during session; seeds from prop
  const [delayMs, setDelayMs] = useState(shadowDelayMsProp);

  const [hidden,   setHidden]   = useState(mode === 'dictation');
  const [savedId,  setSavedId]  = useState<number | null>(null);
  const [toast,    setToast]    = useState<string | null>(null);
  // countdown: ms remaining in the speaking window (null = not in shadow pause)
  const [countdown, setCountdown] = useState<number | null>(null);

  const prevLineRef          = useRef<SubtitleLine | null>(null);
  const shadowPausedRef      = useRef(false);
  const delayTimerRef        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumeTimerRef       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeLineRef        = useRef<SubtitleLine | null>(null);
  const delayMsRef           = useRef(delayMs);

  activeLineRef.current = activeLine;
  delayMsRef.current    = delayMs;

  // ── helpers ──────────────────────────────────────────────────────────────

  const clearCountdown = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdown(null);
  }, []);

  const clearAllTimers = useCallback(() => {
    if (delayTimerRef.current)  { clearTimeout(delayTimerRef.current);  delayTimerRef.current  = null; }
    if (resumeTimerRef.current) { clearTimeout(resumeTimerRef.current); resumeTimerRef.current = null; }
    clearCountdown();
  }, [clearCountdown]);

  /**
   * Pause the video immediately, start the speaking-window countdown,
   * then auto-resume after speakingWindowMs.
   *
   * Call this AFTER the delay has already elapsed (i.e. from inside
   * the delayTimer callback, or from the R-key replay handler).
   */
  const startSpeakingWindow = useCallback((line: SubtitleLine) => {
    if (!videoRef.current) return;

    if (resumeTimerRef.current) { clearTimeout(resumeTimerRef.current); resumeTimerRef.current = null; }
    clearCountdown();

    videoRef.current.pause();
    shadowPausedRef.current = true;

    const windowMs = speakingWindowMs(line, pauseCapMs);
    let remaining  = windowMs;
    setCountdown(remaining);

    countdownIntervalRef.current = setInterval(() => {
      remaining -= 100;
      if (remaining <= 0) { clearCountdown(); }
      else                { setCountdown(remaining); }
    }, 100);

    resumeTimerRef.current = setTimeout(() => {
      resumeTimerRef.current = null;
      clearCountdown();
      if (videoRef.current) videoRef.current.play();
      shadowPausedRef.current = false;
      onSentenceComplete?.(line);
    }, windowMs);
  }, [videoRef, pauseCapMs, clearCountdown, onSentenceComplete]);

  /**
   * Full shadow sequence for a line:
   *   1. Wait delayMs after line.start_ms  ← KEY FIX: user hears the speaker first
   *   2. Pause + open speaking window
   *
   * The delay timer is cancelled if the line changes (seek / next line),
   * so stale timers never fire.
   */
  const startShadowSequence = useCallback((line: SubtitleLine) => {
    clearAllTimers();
    shadowPausedRef.current = false;

    const currentDelay = delayMsRef.current;
    const now          = performance.now();
    // How much of the delay has already elapsed since line.start_ms?
    const elapsed      = Math.max(0, (currentMs - line.start_ms));
    const remaining    = Math.max(0, currentDelay - elapsed);

    if (remaining === 0) {
      // Already past the delay point — pause immediately
      startSpeakingWindow(line);
    } else {
      delayTimerRef.current = setTimeout(() => {
        delayTimerRef.current = null;
        startSpeakingWindow(line);
      }, remaining);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearAllTimers, startSpeakingWindow]);
  // Note: currentMs intentionally NOT in deps — we capture it at call time
  // via the closure; adding it would re-create the callback every frame.

  // ── auto-pause effect ────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'shadow') return;

    clearAllTimers();
    shadowPausedRef.current = false;

    if (!activeLine) return;
    if (prevLineRef.current?.index === activeLine.index) return;
    prevLineRef.current = activeLine;

    startShadowSequence(activeLine);
  }, [activeLine, mode, clearAllTimers, startShadowSequence]);

  // ── keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'p': {
          e.preventDefault();
          if (!videoRef.current) break;
          if (videoRef.current.paused) {
            clearAllTimers();
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
          const line = activeLineRef.current;
          if (line && videoRef.current) {
            videoRef.current.currentTime = line.start_ms / 1000;
            prevLineRef.current = null;
            // Replay: start full sequence (delay → speaking window) from line start
            startShadowSequence(line);
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
  }, [videoRef, clearAllTimers, startShadowSequence]);

  // ── helpers ──────────────────────────────────────────────────────────────

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
      startShadowSequence(line);
    }
  }

  // ── derived display values ───────────────────────────────────────────────
  const isWaitingForDelay = delayTimerRef.current !== null && countdown === null;
  const isCountingDown    = countdown !== null && activeLine !== null;
  const totalWindowMs     = activeLine ? speakingWindowMs(activeLine, pauseCapMs) : 1;
  const countdownSec      = countdown !== null ? (countdown / 1000).toFixed(1) : null;
  const barPct            = isCountingDown ? Math.max(0, (countdown! / totalWindowMs) * 100) : 0;

  // ── render ───────────────────────────────────────────────────────────────
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

        {/* Waiting-for-delay indicator */}
        {mode === 'shadow' && isWaitingForDelay && activeLine && (
          <p className="text-xs text-yellow-500 font-bold text-center animate-pulse">
            🎧 Listen… shadow in {(delayMs / 1000).toFixed(1)}s
          </p>
        )}

        {/* Speaking window countdown bar */}
        {isCountingDown && (
          <div className="space-y-1">
            <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-none"
                style={{ width: `${barPct}%` }}
              />
            </div>
            <p className="text-xs text-indigo-400 font-bold text-center tabular-nums">
              🗣️ Shadow now · {countdownSec}s left
            </p>
          </div>
        )}

        {/* Shadow delay selector — only visible in shadow mode */}
        {mode === 'shadow' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-semibold shrink-0">Delay</span>
            <div className="flex gap-1 flex-1">
              {DELAY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setDelayMs(opt.value)}
                  className={`flex-1 flex flex-col items-center py-1 rounded-lg border text-xs font-bold transition-colors ${
                    delayMs === opt.value
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  <span>{opt.label}</span>
                  <span className={`font-normal ${
                    delayMs === opt.value ? 'text-indigo-200' : 'text-gray-600'
                  }`}>{opt.hint}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Controls row */}
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
          {mode === 'shadow' && !isCountingDown && !isWaitingForDelay && activeLine ? (
            <p className="text-xs text-gray-600">R · replay &nbsp;·&nbsp; Space · pause</p>
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
    watch:     'bg-gray-800 text-gray-400',
    shadow:    'bg-indigo-900/60 text-indigo-400',
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
