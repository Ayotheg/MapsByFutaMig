// ── When and how a queued notification goes out ────────────────────────────
//
// Pure logic for send-push (Deno) and scripts/pushRules.test.mjs (Node).
// The rule from the product side: don't bug people. General news only goes
// out in the weekly round-up; everything else is about something the
// person did, and even those wait out the night.

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// Per kind: which profile switch turns it off (null = can't be switched
// off, e.g. admin alerts), how long it stays worth sending, whether it
// respects quiet hours, and its icon/emoji.
export const KINDS = {
  review: { pref: 'reviews', maxAgeMs: 3 * DAY, quiet: true, emoji: '⭐' },
  weekly: { pref: 'weekly', maxAgeMs: 2 * DAY, quiet: true, emoji: '📍' },
  admin: { pref: null, maxAgeMs: DAY, quiet: true, emoji: '📋' },
  test: { pref: null, maxAgeMs: HOUR, quiet: false, emoji: '🔔' },
  // An admin's "Send preview to admins": the weekly round-up, looking
  // exactly like it, sent now to admins only.
  preview: { pref: null, maxAgeMs: HOUR, quiet: false, emoji: '📍', icon: 'weekly' },
};

// Test pings and previews go out at once; everything else is "normal" —
// never "low", which lets phones hold a push until they're charging.
export function urgencyFor(kind) {
  return kind === 'test' || kind === 'preview' ? 'high' : 'normal';
}

// FUTA is in Lagos time: UTC+1, no daylight saving.
export function lagosHour(ms) {
  return new Date(ms + HOUR).getUTCHours();
}

// Nothing from 10 pm to 7 am.
export function inQuietHours(ms) {
  const h = lagosHour(ms);
  return h >= 22 || h < 7;
}

/**
 * 'send' | 'wait' | 'skip:<reason>' for one queued row.
 * row: { kind, created_at }   ctx: { now, prefs, lastReviewSentAt }
 */
export function decide(row, { now, prefs = {}, lastReviewSentAt = null }) {
  const kind = KINDS[row.kind];
  if (!kind) return 'skip:unknown-kind';
  if (now - Date.parse(row.created_at) > kind.maxAgeMs) return 'skip:expired';
  if (kind.pref && prefs[kind.pref] === false) return 'skip:switched-off';
  if (kind.quiet && inQuietHours(now)) return 'wait';
  // One review reminder a day at most; a second one waits (and expires
  // after three days if it never gets a turn).
  if (row.kind === 'review' && lastReviewSentAt && now - Date.parse(lastReviewSentAt) < DAY) return 'wait';
  return 'send';
}

// iPhones show no icons or pictures, so the title carries an emoji there.
export function isApplePush(endpoint) {
  try {
    return new URL(endpoint).hostname.endsWith('push.apple.com');
  } catch {
    return false;
  }
}

/** The JSON the service worker receives (public/sw.js 'push' handler). */
export function buildPayload(row, endpoint) {
  const kind = KINDS[row.kind] || {};
  const apple = isApplePush(endpoint);
  return JSON.stringify({
    kind: row.kind,
    title: apple && kind.emoji ? `${kind.emoji} ${row.title}` : row.title,
    body: row.body || '',
    url: row.url || '/map',
    icon: `/push/${kind.icon || row.kind}.png`,
    badge: '/push/badge.png',
    image: row.image || undefined,
    tag: row.tag || undefined,
    actions: Array.isArray(row.actions) ? row.actions.slice(0, 2) : undefined,
  });
}
