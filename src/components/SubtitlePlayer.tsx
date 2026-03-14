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
  /** How many ms after sentence START to pause for shadowing. Default 2000ms. */
  delayMs?: number;
  onSentenceComplete?: (line: SubtitleLine) => void;
  onSaved?: (entry: VaultEntry) => void;
}

/**
 * Speaking window after pause fires.
 * User has max(charCount × 130ms, 2500ms) to shadow the sentence.
 */
function speakingWindowMs(line: SubtitleLine): number {
  const charCount = line.text.replace(/\s/g, '').length;
  return Math.max(charCount * 130, 2500);
}

export default function SubtitlePlayer({
  lines, currentMs, animeId, animeName, episodeNumber,
  videoRef, mode,
  delayMs = 2000,
  onSentenceComplete, onSaved,
}: Props) {
  const activeLine                  = getActiveLine(lines, currentMs);
  const [hidden, setHidden]         = useState(mode === 'dictation');
  const [savedId, setSavedId]       = useState<number | null>(null);
  const [toast, setToast]           = useState<string | null>(null);
  const [countdown, setCountdown]   = useState<number | null>(null);
  // Live-adjustable delay — starts from prop, user can toggle during session
  const [activeDelay, setActiveDelay] = useState(delayMs);
  const prevLineRef                 = useRef<SubtitleLine | null>(null);
  const shadowPausedRef             = useRef(false);
  const resumeTimerRef              = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeLineRef               = useRef<SubtitleLine | null>(null);
  activeLineRef.current             = activeLine;

  const clearCountdown = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdown(null);
  }, []);

  const startShadowPause = useCallback((line: SubtitleLine, pauseAfterMs: number) => {
    if (!videoRef.current) return;

    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
    clearCountdown();

    // Schedule pause to fire at start_ms + pauseAfterMs.
    // If the video is already past that point, fire immediately.
    const nowMs       = videoRef.current.currentTime * 1000;
    const pauseAtMs   = line.start_ms + pauseAfterMs;
    const waitMs      = Math.max(0, pauseAtMs - nowMs);
    const speakMs     = speakingWindowMs(line);
    const totalMs     = waitMs + speakMs;

    // Countdown covers only the speaking window (after the pause fires)
    let remaining = speakMs;

    resumeTimerRef.current = setTimeout(() => {
      // Fire the actual pause
      if (videoRef.current) videoRef.current.pause();
      shadowPausedRef.current = true;

      setCountdown(remaining);
      countdownIntervalRef.current = setInterval(() => {
        remaining -= 100;
        if (remaining <= 0) {
          clearCountdown();
        } else {
          setCountdown(remaining);
        }
      }, 100);

      // Resume after speaking window
      resumeTimerRef.current = setTimeout(() => {
        resumeTimerRef.current = null;
        clearCountdown();
        if (videoRef.current) videoRef.current.play();
        shadowPausedRef.current = false;
        onSentenceComplete?.(line);
      }, speakMs);

    }, waitMs);

  }, [videoRef, clearCountdown, onSentenceComplete]);

  // Shadow mode: auto-pause on new line
  useEffect(() => {
    if (mode !== 'shadow') return;

    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
    clearCountdown();

    if (!activeLine) return;
    if (prevLineRef.current?.index === activeLine.index) return;
    prevLineRef.current = activeLine;
    shadowPausedRef.current = false;

    startShadowPause(activeLine, activeDelay);
  }, [activeLine, mode, clearCountdown, startShadowPause, activeDelay]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      switch (e.key.toLowerCase()) {
        case ' ':
        case 'p': {
          e.preventDefault();
          if (!videoRef.current) break;
          if (videoRef.current.paused) {
            if (resumeTimerRef.current) { clearTimeout(resumeTimerRef.current); resumeTimerRef.current = null; }
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
          const line = activeLineRef.current;
          if (line && videoRef.current) {
            videoRef.current.currentTime = line.start_ms / 1000;
            prevLineRef.current = null;
            startShadowPause(line, activeDelay);
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
  }, [videoRef, clearCountdown, startShadowPause, activeDelay]);

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
      startShadowPause(line, activeDelay);
    }
  }

  const isCountingDown = countdown !== null && activeLine !== null;
  const speakMs        = activeLine ? speakingWindowMs(activeLine) : 1;
  const countdownSec   = countdown !== null ? (countdown / 1000).toFixed(1) : null;
  const barPct         = isCountingDown ? Math.max(0, (countdown! / speakMs) * 100) : 0;

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

        {/* Countdown bar */}
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
            <ControlBtn onClick={replayLine} title="Replay (R)" emoji="🔁" />
            <ControlBtn
              onClick={() => setHidden(h => !h)}
              title="Hide/show subtitle (H)"
              emoji={hidden ? '👁️' : '🚫'}
              active={hidden}
            />
          </div>

          {/* Live delay toggle */}
          {mode === 'shadow' && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500 mr-1">Delay:</span>
              {[2000, 1000, 500].map(d => (
                <button
                  key={d}
                  onClick={() => setActiveDelay(d)}
                  className={`text-xs px-2 py-0.5 rounded-full font-bold transition-colors ${
                    activeDelay === d
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {d / 1000}s
                </button>
              ))}
            </div>
          )}

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

        {/* Mode badge */}
        <div className="flex items-center justify-between">
          <ModeBadge mode={mode} />
          {mode === 'shadow' && !isCountingDown && (
            <p className="text-xs text-gray-600">Pauses {activeDelay / 1000}s after sentence starts</p>
          )}
          {mode !== 'shadow' && (
            <p className="text-xs text-gray-600">Space · pause &nbsp;·&nbsp; R · replay &nbsp;·&nbsp; S · save</p>
          )}
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
