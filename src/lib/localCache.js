// ── Cache-first fallback store ──────────────────────────────────────────────
//
// Used by useWaypoints/useSegments (and anything else that wants "show
// something real even if the network is bad") to keep a last-known-good
// copy of server data around. Not a general-purpose cache — just enough to
// answer "what did we last successfully load?" so a flaky/offline client
// gets real pins instead of a blank map.
//
// Deliberately separate from React state: this needs to survive a full
// page reload (a student who re-opens the app on a bad connection should
// still see yesterday's map instantly), which plain useState/useRef can't
// do.

const PREFIX = 'futamaps:cache:';
// Bump after admin/map data changes so an older snapshot cannot hide newly
// approved or edited waypoints from the map and search index.
const VERSION = 2;

export function cacheSet(key, value) {
  try {
    const payload = { v: VERSION, savedAt: Date.now(), value };
    localStorage.setItem(PREFIX + key, JSON.stringify(payload));
  } catch {
    // Storage full/unavailable (private browsing, quota) — fallback cache
    // is a nice-to-have, never worth throwing over.
  }
}

/**
 * Returns { value, savedAt, ageMs } or null if nothing usable is cached.
 */
export function cacheGet(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.v !== VERSION || parsed?.value === undefined) return null;
    return { value: parsed.value, savedAt: parsed.savedAt, ageMs: Date.now() - parsed.savedAt };
  } catch {
    return null;
  }
}
