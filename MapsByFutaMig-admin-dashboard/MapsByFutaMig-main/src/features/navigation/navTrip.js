// ── Navigation trip identity ─────────────────────────────────────────────
//
// A "trip" is one navigation session from `startNavigation()` to arrival.
// Each gets a UUID so a completion can be recorded idempotently
// (`record_navigation_completion` in supabase/profile_stats.sql counts a
// given (user, trip) at most once, however many times it's reported).
//
// The id and a `completionReported` flag are stored inside the persisted
// `navigation-session` object so a page reload mid-arrival — which
// restores the session with fresh in-memory refs and can re-run arrival
// detection — cannot report the same trip a second time.

export function createTripId(cryptoLike = globalThis.crypto) {
  if (cryptoLike?.randomUUID) return cryptoLike.randomUUID();
  // Fallback for very old browsers: RFC 4122 v4 shape from Math.random.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// Normalises the trip fields of a persisted session. A session saved by an
// older build has no `tripId`; it gets a fresh one (and, having no record
// of a prior report, `completionReported: false`).
export function restoreTrip(persisted, makeId = createTripId) {
  return {
    tripId: typeof persisted?.tripId === 'string' && persisted.tripId ? persisted.tripId : makeId(),
    completionReported: persisted?.completionReported === true,
  };
}

// The once-per-trip gate. Returns true exactly once per `trip` object; every
// later call (duplicate arrival callbacks, a restored session re-detecting
// arrival) returns false. `trip` is a plain mutable { completionReported }.
export function claimCompletion(trip) {
  if (!trip || trip.completionReported) return false;
  trip.completionReported = true;
  return true;
}
