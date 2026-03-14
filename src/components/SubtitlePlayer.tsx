import { useEffect, useRef, useState } from 'react';
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
  onSentenceComplete?: (line: SubtitleLine) => void;
  onSaved?: (entry: VaultEntry) => void;
}

/**
 * Pause duration for shadow mode.
 * lineDuration + max(charCount × 130ms, 2000ms) + 800ms, capped at 12s.
 */
function shadowPauseMs(line: SubtitleLine): number {
  const lineDuration = line.end_ms - line.start_ms;
  const charCount    = line.text.replace(/\s/g, '').length;
  const repeatMs     = Math.max(charCount * 130, 2000);
  return Math.min(lineDuration + repeatMs + 800, 12000);
}

export default function SubtitlePlayer({
  lines, currentMs, animeId, animeName, episodeNumber,
  videoRef, mode, onSentenceComplete, onSaved,
}: Props) {
  const activeLine          = getActiveLine(lines, currentMs);
  const [hidden, setHidden] = useState(mode === 'dictation');
  const [savedId, setSavedId]   = useState<number | null>(null);
  const [toast, setToast]       = useState<string | null>(null);
  const prevLineRef             = useRef<SubtitleLine | null>(null);
  const shadowPausedRef         = useRef(false);
  const resumeTimerRef          = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Shadow mode: auto-pause on new line.
  //
  // FIX: We always clear any running timer when activeLine changes (including
  // on manual seeks). This prevents a stale timer from an old line firing and
  // resuming playback at the wrong moment. shadowPausedRef is also reset so
  // the new line always gets its own fresh pause — otherwise seeking forward
  // while already paused would silently skip the new line's pause window.
  useEffect(() => {
    if (mode !== 'shadow') return;

    // Always cancel any pending auto-resume when the active line changes,
    // regardless of whether we are currently in a shadow pause.
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }

    if (!activeLine) return;

    // Same line as before — nothing to do (guards against currentMs ticks
    // within the same subtitle line without a real line change).
    if (prevLineRef.current?.index === activeLine.index) return;
    prevLineRef.current = activeLine;

    // Reset the pause guard so this new line always triggers a fresh pause,
    // even if the previous line's timer was still running when we seeked.
    shadowPausedRef.current = false;

    if (videoRef.current) {
      videoRef.current.pause();
      shadowPausedRef.current = true;

      resumeTimerRef.current = setTimeout(() => {
        resumeTimerRef.current = null;
        if (videoRef.current) videoRef.current.play();
        shadowPausedRef.current = false;
        onSentenceComplete?.(activeLine);
      }, shadowPauseMs(activeLine));
    }
  }, [activeLine, mode, videoRef, onSentenceComplete]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;

      switch (e.key.toLowerCase()) {
        case ' ':   // Space — manual pause/resume (backup for auto-pause)
        case 'p': {
          e.preventDefault();
          if (!videoRef.current) break;
          if (videoRef.current.paused) {
            // If auto-timer is running, cancel it so user controls resume
            if (resumeTimerRef.current) {
              clearTimeout(resumeTimerRef.current);
              resumeTimerRef.current = null;
            }
            shadowPausedRef.current = false;
            videoRef.current.play();
          } else {
            videoRef.current.pause();
            shadowPausedRef.current = true;
          }
          break;
        }
        case 'h': setHidden(h => !h); break;
        case 'r':
          if (activeLine && videoRef.current) {
            videoRef.current.currentTime = activeLine.start_ms / 1000;
            videoRef.current.play();
          }
          break;
        case 's':
          if (activeLine) saveToVault(activeLine);
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
  }, [activeLine, videoRef]);

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
    if (activeLine && videoRef.current) {
      videoRef.current.currentTime = activeLine.start_ms / 1000;
      videoRef.current.play();
    }
  }

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
          {mode === 'shadow' && activeLine ? (
            <p className="text-xs text-gray-600">⏱ {(shadowPauseMs(activeLine) / 1000).toFixed(1)}s · Space to pause/resume</p>
          ) : (
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
