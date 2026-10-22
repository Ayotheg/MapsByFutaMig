import { readPersistentState, removePersistentState, writePersistentState } from '../../lib/persistentState.js';

// ── Fresh start after a long absence ─────────────────────────────────────
//
// The map restores what was open (an active trip, a place card, a chip…)
// so a reload or a quick app switch picks up where the person left off.
// After this long away (tab hidden, screen off, browser closed) that state
// is stale — most often a trip nobody ended — so the next visit starts
// fresh instead, and a tab still open in the background reloads.
export const MAP_IDLE_RESET_MS = 30 * 60 * 1000;

const LAST_ACTIVE_KEY = 'map-last-active';

// Preferences (sidebar layout, chosen tab, map position) survive a reset.
const SESSION_KEYS = [
  'navigation-session',
  'navigation-destination',
  'navigation-open',
  'navigation-seeded-destination',
  'selected-place',
  'selected-segment',
  'active-chip',
  'mobile-search-open',
];

let reloading = false;

export function isIdleSince(lastActive, now) {
  return typeof lastActive === 'number' && now - lastActive > MAP_IDLE_RESET_MS;
}

export function markMapActive() {
  // Pagehide during an idle reload must not make the reloaded page think
  // the person never left.
  if (reloading) return;
  writePersistentState(LAST_ACTIVE_KEY, Date.now());
}

/** Drops restorable map state if the map sat unused too long. Call before
 * anything reads that state. Returns true if it reset. */
export function resetIdleMapSession() {
  if (!isIdleSince(readPersistentState(LAST_ACTIVE_KEY, null), Date.now())) return false;
  SESSION_KEYS.forEach(removePersistentState);
  return true;
}

/** For a tab that stayed open in the background: reload it, and the
 * reloaded page's resetIdleMapSession() clears the state. */
export function reloadIfIdle() {
  if (!isIdleSince(readPersistentState(LAST_ACTIVE_KEY, null), Date.now())) return false;
  reloading = true;
  window.location.reload();
  return true;
}
