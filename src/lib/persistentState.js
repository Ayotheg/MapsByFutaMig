const STORAGE_PREFIX = 'maps-by-futa:';

function storageKey(key) {
  return `${STORAGE_PREFIX}${key}`;
}

export function readPersistentState(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(storageKey(key));
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writePersistentState(key, value) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(key), JSON.stringify(value));
  } catch {
    // Storage can be unavailable or full; memory state still remains usable.
  }
}

export function removePersistentState(key) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(storageKey(key));
  } catch {
    // Ignore storage failures during cleanup.
  }
}
