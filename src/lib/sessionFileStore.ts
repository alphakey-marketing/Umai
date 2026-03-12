/**
 * sessionFileStore.ts
 *
 * Problem: File objects cannot be serialised through React Router location.state
 * (the state is cloned via structuredClone which drops File objects in some
 * environments, and blob: URLs are revoked after navigation).
 *
 * Solution: store the File in a plain module-level Map keyed by a short ID.
 * The ID is safe to pass through location.state (it's just a string).
 * The Map lives as long as the browser tab — perfect for a single session.
 */

const store = new Map<string, File>();

export function storeFile(file: File): string {
  const id = `file_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  store.set(id, file);
  return id;
}

export function retrieveFile(id: string): File | null {
  return store.get(id) ?? null;
}

export function releaseFile(id: string): void {
  store.delete(id);
}
