// ── Sharing walked shortcuts, and whether learned ones get used ──────────
//
// `share` sends each shortcut stretch found by shortcutDetect.js to
// `submit_shortcut_walk`; `reportOutcome` tells `report_shortcut_outcome`
// whether someone routed through a learned shortcut actually walked it
// (supabase/learned_shortcuts.sql). Guests count as their browser's
// anonymous id, signed-in users as their account.
//
// Same delivery design as navCompletion.js: queued in storage BEFORE the
// network call, retried later if it fails. Both RPCs are idempotent per
// (contributor, trip, …), so a retry never counts twice.
//
// `rpc` and `storage` are injected so this file can be tested in plain
// Node — see scripts/learnedShortcuts.test.mjs. Real wiring is
// learnedShortcutsClient.js.

export const PENDING_KEY = 'pending-shortcut-walks';
export const PENDING_OUTCOMES_KEY = 'pending-shortcut-outcomes';
export const CONSENT_KEY = 'share-shortcuts';
export const MAX_PENDING = 30;
export const MAX_PENDING_AGE_MS = 14 * 24 * 60 * 60 * 1000;

// Rejections that will never succeed on retry (bad data, outside campus).
const PERMANENT_ERROR_CODES = new Set(['22023', '22004']);

// A storage-backed retry queue for one RPC. `same(a, b)` says whether two
// entries are the same submission; `args(entry)` builds the RPC arguments.
function createQueue({ rpc, storage, now, onError, key, fn, same, args }) {
  function read() {
    const raw = storage.read(key, []);
    if (!Array.isArray(raw)) return [];
    const t = now();
    return raw.filter((e) => e && typeof e.tripId === 'string' && typeof e.ts === 'number' && t - e.ts < MAX_PENDING_AGE_MS);
  }
  function write(queue) {
    if (queue.length === 0) storage.remove(key);
    else storage.write(key, queue.slice(-MAX_PENDING));
  }

  // true = the server has dealt with it (accepted, duplicate, throttled or
  // rejected for good); false = try again later.
  async function attempt(entry) {
    try {
      const { error } = await rpc(fn, args(entry));
      if (error && !PERMANENT_ERROR_CODES.has(error.code)) throw error;
      write(read().filter((e) => !same(e, entry)));
      return true;
    } catch (err) {
      onError(err);
      return false;
    }
  }

  return {
    async send(entries) {
      const queue = read();
      for (const e of entries) if (!queue.some((q) => same(q, e))) queue.push(e);
      write(queue);
      let sent = 0;
      for (const e of entries) if (await attempt(e)) sent++;
      return sent;
    },
    // Retry anything queued, oldest first; stop at the first failure.
    async flush() {
      let cleared = 0;
      for (const e of read()) {
        if (!(await attempt(e))) break;
        cleared++;
      }
      return cleared;
    },
  };
}

export function createShortcutSharer({ rpc, storage, anonId, now = () => Date.now(), onError = () => {} }) {
  const walks = createQueue({
    rpc, storage, now, onError,
    key: PENDING_KEY,
    fn: 'submit_shortcut_walk',
    same: (a, b) => a.tripId === b.tripId && a.seq === b.seq,
    args: (w) => ({ p_trip_id: w.tripId, p_seq: w.seq, p_path: w.path, p_saved_m: w.saved, p_anon_id: anonId() }),
  });
  const outcomes = createQueue({
    rpc, storage, now, onError,
    key: PENDING_OUTCOMES_KEY,
    fn: 'report_shortcut_outcome',
    same: (a, b) => a.tripId === b.tripId && a.shortcutId === b.shortcutId,
    args: (o) => ({ p_shortcut_id: o.shortcutId, p_trip_id: o.tripId, p_used: o.used, p_anon_id: anonId() }),
  });

  return {
    // null = not asked yet, true/false = the user's answer.
    consent: () => storage.read(CONSENT_KEY, null),
    setConsent: (value) => storage.write(CONSENT_KEY, value === true),

    // Never throws. `shortcuts` is findShortcuts()'s result for one trip.
    async share(tripId, shortcuts) {
      if (!tripId || !shortcuts?.length) return 0;
      return walks.send(shortcuts.slice(0, 10).map((s, seq) => ({ tripId, seq, path: s.path, saved: s.saved, ts: now() })));
    },

    // Never throws. `results` is [{ shortcutId, used }] for one trip.
    async reportOutcomes(tripId, results) {
      if (!tripId || !results?.length) return 0;
      return outcomes.send(results.map(({ shortcutId, used }) => ({ tripId, shortcutId, used: used === true, ts: now() })));
    },

    async flush() {
      return (await walks.flush()) + (await outcomes.flush());
    },
  };
}
