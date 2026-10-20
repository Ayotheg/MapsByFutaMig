// "Rate your visit" — a review is asked for a while after someone reaches a
// rateable place, not on arrival (they haven't had the haircut/meal yet).
// Web: ReviewPrompt shows it the next time the map is open once it's due.
// (The Android app will use a scheduled local notification instead.)
//
// One pending visit per device (the latest replaces the last), in
// localStorage. Storage can be unavailable (private mode, blocked site
// data), so every access is guarded and failure just means no prompt.

const KEY = 'futa_pending_review_v1';
export const REVIEW_DELAY_MS = 60 * 60 * 1000; // 1 hour after the visit
export const REVIEW_EXPIRY_MS = 3 * 24 * 60 * 60 * 1000; // stop asking after 3 days

/** Remember a visit to `dest` ({ id, name, type }). */
export function rememberVisit(dest, now = Date.now()) {
  if (!dest?.id) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ id: dest.id, name: dest.name, type: dest.type, visitedAt: now }));
  } catch {
    /* no storage — no prompt */
  }
}

function readPending() {
  try {
    const raw = localStorage.getItem(KEY);
    const p = raw ? JSON.parse(raw) : null;
    return p && p.id && typeof p.visitedAt === 'number' ? p : null;
  } catch {
    return null;
  }
}

export function clearPendingReview() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/**
 * The visit to ask about now, or null. Not yet due → null (kept). Expired
 * → cleared. Returns `{ dest: { id, name, type }, dueAt }` when due, or
 * `{ dest: null, dueAt }` while still waiting, so callers can schedule a
 * re-check.
 */
export function checkPendingReview(now = Date.now()) {
  const p = readPending();
  if (!p) return { dest: null, dueAt: null };
  if (now - p.visitedAt > REVIEW_EXPIRY_MS) {
    clearPendingReview();
    return { dest: null, dueAt: null };
  }
  const dueAt = p.visitedAt + REVIEW_DELAY_MS;
  if (now < dueAt) return { dest: null, dueAt };
  return { dest: { id: p.id, name: p.name, type: p.type }, dueAt };
}
