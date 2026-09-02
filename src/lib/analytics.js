import { supabase } from './supabase';

// ── Slice 14: lightweight first-party event tracking ────────────────────
//
// New file, no legacy equivalent — this whole feature is new, not a port
// (see ANALYTICS_BUILD_PLAN.md §0). Backs the admin-only "Insights" tab
// (src/features/analytics/). Writes only to `analytics_events`
// (supabase/analytics.sql) via an anon-key insert-only RLS policy — this
// module never reads that table back; reads are admin-only RPCs called
// directly from the Insights tab components.
//
// ── Identity ──────────────────────────────────────────────────────────
// `anon_id` (localStorage, `futa_anon_id`) is a persistent per-browser id
// — this, not a per-session id, is what "unique visitor" counts against,
// so reloads/new tabs/repeat visits from the same browser don't inflate
// the count (the exact flaw the client called out in generic analytics
// tools).
//
// `session_id` (sessionStorage, `futa_session_id`) is a per-tab id used
// for session-level grouping (one "session" = one tab's visit) — kept
// deliberately separate from `anon_id`, since one visitor can have many
// sessions.
//
// When a user signs in, subsequent events additionally carry `user_id` —
// past anonymous events are NOT retroactively rewritten (that would be
// surprising, and isn't necessary for accurate counting; "unique" always
// dedupes on `coalesce(user_id, anon_id)`).

const ANON_ID_KEY = 'futa_anon_id';
const SESSION_ID_KEY = 'futa_session_id';
const FLUSH_INTERVAL_MS = 5000;

function createStableUuid() {
  const cryptoObj = typeof window !== 'undefined' ? window.crypto : globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (cryptoObj && cryptoObj.getRandomValues) {
    cryptoObj.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function readOrCreate(storage, key) {
  try {
    let v = storage.getItem(key);
    if (!v) {
      v = createStableUuid();
      storage.setItem(key, v);
    }
    return v;
  } catch {
    // Storage unavailable (private mode, disabled storage, etc.) — fall
    // back to an in-memory id for this page load rather than throwing.
    return createStableUuid();
  }
}

export function getAnonId() {
  return readOrCreate(window.localStorage, ANON_ID_KEY);
}

export function getSessionId() {
  return readOrCreate(window.sessionStorage, SESSION_ID_KEY);
}

function detectDeviceType() {
  // Cheap client-side heuristic, matches the pattern MobFabCluster/
  // MobileSheet already use elsewhere in this codebase — not a full
  // user-agent parse.
  return window.matchMedia('(max-width: 768px)').matches ? 'mobile' : 'desktop';
}

let currentUserId = null;

/** Called once from MapPage.jsx when useAuth()'s `user` changes, so every
 * subsequent track() call carries the right user_id without every call
 * site having to pass it in explicitly. */
export function setAnalyticsUser(userId) {
  currentUserId = userId || null;
}

let queue = [];
let flushTimer = null;

async function flush() {
  if (queue.length === 0) return;
  const batch = queue;
  queue = [];
  try {
    const { error } = await supabase.from('analytics_events').insert(batch);
    if (error) {
      // Don't retry-loop indefinitely on a permanent failure (e.g. the
      // migration hasn't been run yet) — log once per flush and drop the
      // batch, same "tolerant of the table not existing yet" posture
      // quickChipsApi.js already established for Quick Chips.
      console.info('[analytics] flush failed, dropping batch:', error.message || error);
    }
  } catch (e) {
    console.info('[analytics] flush failed, dropping batch:', e?.message || e);
  }
}

function ensureFlushTimer() {
  if (flushTimer) return;
  flushTimer = setInterval(flush, FLUSH_INTERVAL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  // navigator.sendBeacon isn't usable with the Supabase client directly
  // (it needs a plain URL + body, not an authenticated PostgREST
  // request), so this is a best-effort synchronous flush instead —
  // accept it may occasionally miss the very last event on a hard
  // tab-close, a reasonable tradeoff over blocking every interaction on
  // a network call. Flagged as a known limitation in analytics.sql too.
  window.addEventListener('pagehide', () => {
    flush();
  });
}

/** Queues one event; flushed in a batch every ~5s or on tab-hide/close.
 * Keep `props` small and structured — analytics_events is queried a lot,
 * don't dump entire objects/HTML/large free text into it. */
export function track(eventName, props = {}) {
  ensureFlushTimer();
  queue.push({
    event_name: eventName,
    props,
    session_id: getSessionId(),
    anon_id: getAnonId(),
    user_id: currentUserId,
    path: window.location.pathname,
    device_type: detectDeviceType(),
    created_at: new Date().toISOString(),
  });
}