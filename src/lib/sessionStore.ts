/**
 * sessionStore.ts
 *
 * Holds the video File across the navigate() boundary.
 * File objects cannot survive history.pushState (structured-clone drops them).
 *
 * SessionSetupPage writes the File here before navigate().
 * SessionRunPage reads it on mount, creates its OWN blob URL via useRef,
 * and is solely responsible for revoking it.
 *
 * We deliberately do NOT store or manage the blob URL here anymore —
 * that was the source of the Strict Mode revoke race.
 */

let _videoFile: File | null = null;

export function setSessionFile(file: File): void {
  _videoFile = file;
}

export function getSessionFile(): File | null {
  return _videoFile;
}

export function clearSessionFile(): void {
  _videoFile = null;
}
