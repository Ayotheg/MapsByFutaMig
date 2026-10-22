// ── Sharing walked shortcuts ─────────────────────────────────────────────
//
// Sends each shortcut stretch found by shortcutDetect.js to
// `submit_shortcut_walk` (supabase/learned_shortcuts.sql). Guests count as
// their browser's anonymous id, signed-in users as their account.
//
// Same delivery design as navCompletion.js: queued in storage BEFORE the
// network call, retried later if it fails. The RPC is idempotent per
// (contributor, trip, seq), so a retry never counts twice.
//
// `rpc` and `storage` are injected so this file can be tested in plain
// Node — see scripts/learnedShortcuts.test.mjs. Real wiring is
// learnedShortcutsClient.js.

export const PENDING_KEY = 'pending-shortcut-walks';
export const CONSENT_KEY = 'share-shortcuts';
export const MAX_PENDING = 30;
export const MAX_PENDING_AGE_MS = 14 * 24 * 60 * 60 * 1000;

// Rejections that will never succeed on retry (bad data, outside campus).
const PERMANENT_ERROR_CODES = new Set(['22023', '22004']);

const sameWalk = (a, b) => a.tripId === b.tripId && a.seq === b.seq;

export function createShortcutSharer({ rpc, storage, anonId, now = () => Date.now(), onError = () => {} }) {
  function readQueue() {
    const raw = storage.read(PENDING_KEY, []);
    if (!Array.isArray(raw)) return [];
    const t = now();
    return raw.filter((e) => e && typeof e.tripId === 'string' && Array.isArray(e.path) && typeof e.ts === 'number' && t - e.ts < MAX_PENDING_AGE_MS);
  }
  function writeQueue(queue) {
    if (queue.length === 0) storage.remove(PENDING_KEY);
    else storage.write(PENDING_KEY, queue.slice(-MAX_PENDING));
  }
  const dequeue = (walk) => writeQueue(readQueue().filter((e) => !sameWalk(e, walk)));

  // true = the server has dealt with it (accepted, duplicate, throttled or
  // rejected for good); false = try again later.
  async function attempt(walk) {
    try {
      const { error } = await rpc('submit_shortcut_walk', {
        p_trip_id: walk.tripId,
        p_seq: walk.seq,
        p_path: walk.path,
        p_saved_m: walk.saved,
        p_anon_id: anonId(),
      });
      if (error && !PERMANENT_ERROR_CODES.has(error.code)) throw error;
      dequeue(walk);
      return true;
    } catch (err) {
      onError(err);
      return false;
    }
  }

  return {
    // null = not asked yet, true/false = the user's answer.
    consent: () => storage.read(CONSENT_KEY, null),
    setConsent: (value) => storage.write(CONSENT_KEY, value === true),

    // Never throws. `shortcuts` is findShortcuts()'s result for one trip.
    async share(tripId, shortcuts) {
      if (!tripId || !shortcuts?.length) return 0;
      const walks = shortcuts.slice(0, 10).map((s, seq) => ({ tripId, seq, path: s.path, saved: s.saved, ts: now() }));
      const queue = readQueue();
      for (const w of walks) if (!queue.some((e) => sameWalk(e, w))) queue.push(w);
      writeQueue(queue);
      let sent = 0;
      for (const w of walks) if (await attempt(w)) sent++;
      return sent;
    },

    // Retry anything queued, oldest first; stop at the first failure.
    async flush() {
      let cleared = 0;
      for (const w of readQueue()) {
        if (!(await attempt(w))) break;
        cleared++;
      }
      return cleared;
    },
  };
}
