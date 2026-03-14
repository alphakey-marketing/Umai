/**
 * sessionStore.ts
 *
 * React Router's navigate() passes state through history.pushState(), which
 * uses the structured-clone algorithm. File objects are NOT cloneable and are
 * silently dropped, so videoFile and videoObjectURL arrive as undefined in
 * SessionRunPage when passed via location.state.
 *
 * This module holds those two values in plain module-level variables that
 * survive a same-tab navigation without any serialization. SessionSetupPage
 * writes here immediately before calling navigate(); SessionRunPage reads here
 * on mount.
 *
 * SessionRunPage is responsible for calling clearSessionStore() (or letting
 * the cleanup revokeSessionVideo() handle it) when the session ends.
 */

interface SessionStore {
  videoFile:      File | null;
  videoObjectURL: string;
}

const store: SessionStore = {
  videoFile:      null,
  videoObjectURL: '',
};

export function setSessionVideo(file: File, objectURL: string): void {
  store.videoFile      = file;
  store.videoObjectURL = objectURL;
}

export function getSessionVideo(): SessionStore {
  return { ...store };
}

/** Revoke the blob URL and clear the store. Call on SessionRunPage unmount. */
export function revokeSessionVideo(): void {
  if (store.videoObjectURL) {
    URL.revokeObjectURL(store.videoObjectURL);
  }
  store.videoFile      = null;
  store.videoObjectURL = '';
}
