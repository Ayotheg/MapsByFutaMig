// ── Profile card notices the user has cleared ────────────────────────────
//
// "Clear" on a declined event card in the profile (AuthModal) hides it on
// this device. Keys include the state, so only that notice is hidden.

const PREFIX = 'mbf.clearedNotices.';
const MAX_KEYS = 50;

export function eventNoticeKey(ev) {
  return `event:${ev.id}:${ev.state}`;
}

export function loadClearedNotices(userId) {
  if (!userId) return [];
  try {
    const list = JSON.parse(window.localStorage.getItem(PREFIX + userId) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveClearedNotices(userId, keys) {
  if (!userId) return;
  try {
    window.localStorage.setItem(PREFIX + userId, JSON.stringify(keys.slice(-MAX_KEYS)));
  } catch {
    // Storage blocked (private mode): the card just stays cleared until reload.
  }
}
