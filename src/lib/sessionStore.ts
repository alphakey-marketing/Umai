/**
 * sessionStore.ts — intentionally empty / no-op.
 *
 * Previous attempts to use this module to pass File + videoObjectURL across
 * navigate() introduced React Strict Mode revoke races that broke video playback.
 *
 * The original working pattern (passing both via location.state) is restored.
 * This file is kept to avoid broken imports but exports nothing meaningful.
 */

export {};
