// ── Recording a completed navigation for the signed-in user ──────────────
//
// Called when arrival detection confirms a trip genuinely finished (never
// on opening navigation, cancelling, or dismissing the HUD). The server
// side is `record_navigation_completion(p_trip_id)` in
// supabase/profile_stats.sql: idempotent per (user, trip), signed-in only.
//
// If the call fails (offline, DB unavailable, SQL not yet applied) the trip
// id is queued in localStorage and retried later. Retrying is safe because
// the RPC is idempotent — a queued trip is still counted at most once.
//
// `rpc` and `storage` are injected so this file has no import of
// ../../lib/supabase and can be unit-tested in plain Node — see
// scripts/navCompletion.test.mjs. The real wiring is navCompletionClient.js.

export const PENDING_KEY = 'pending-nav-completions';
export const MAX_PENDING = 20;
export const MAX_PENDING_AGE_MS = 14 * 24 * 60 * 60 * 1000;

function readQueue(storage, now) {
  const raw = storage.read(PENDING_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (e) => e && typeof e.userId === 'string' && typeof e.tripId === 'string' && typeof e.ts === 'number' && now - e.ts < MAX_PENDING_AGE_MS
  );
}

function writeQueue(storage, queue) {
  if (queue.length === 0) storage.remove(PENDING_KEY);
  else storage.write(PENDING_KEY, queue.slice(-MAX_PENDING));
}

function enqueue(storage, userId, tripId, now) {
  const queue = readQueue(storage, now);
  if (!queue.some((e) => e.userId === userId && e.tripId === tripId)) queue.push({ userId, tripId, ts: now });
  writeQueue(storage, queue);
}

function dequeue(storage, userId, tripId, now) {
  writeQueue(storage, readQueue(storage, now).filter((e) => !(e.userId === userId && e.tripId === tripId)));
}

export function createNavCompletionRecorder({ rpc, storage, now = () => Date.now(), onError = () => {} }) {
  // One attempt for one trip. Returns true if the server has dealt with it
  // (counted OR recognised as duplicate/throttled), false if it should be
  // retried later.
  async function attempt(userId, tripId) {
    try {
      const { data, error } = await rpc('record_navigation_completion', { p_trip_id: tripId });
      if (error) throw error;
      dequeue(storage, userId, tripId, now());
      return data ?? true;
    } catch (err) {
      onError(err);
      return false;
    }
  }

  return {
    // Never throws. A falsy trip id (can't be made idempotent) is ignored
    // rather than counted blindly.
    async report(userId, tripId) {
      if (!userId || !tripId) return false;
      enqueue(storage, userId, tripId, now()); // persist BEFORE the network call so a tab close can't lose it
      return attempt(userId, tripId);
    },

    // Retry anything queued for this user. Sequential on purpose: the RPC
    // throttles completions that land within seconds of each other, and
    // sequential keeps a backlog from hammering the server.
    async flush(userId) {
      if (!userId) return 0;
      let cleared = 0;
      for (const entry of readQueue(storage, now()).filter((e) => e.userId === userId)) {
        if (await attempt(userId, entry.tripId)) cleared++;
        else break; // still failing — stop, try again next time
      }
      return cleared;
    },
  };
}
