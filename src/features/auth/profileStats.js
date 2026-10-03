// ── Profile stats loader ─────────────────────────────────────────────────
//
// Reads the signed-in user's `review_count` / `nav_count` from `profiles`
// (supabase/profile_stats.sql) and classifies the outcome so the Profile
// tab can tell apart four situations that used to collapse into "0" or "—":
//
//   { status: 'ready',   reviews, navs }  real counters
//   { status: 'missing' }                 query worked, but no profiles row
//                                         exists for this user (needs the
//                                         backfill in profile_stats.sql)
//   { status: 'error',   message }        database unreachable / timed out /
//                                         table or policy missing / bad data
//
// A missing row or an error is NEVER reported as a count of zero.
//
// `client` is injected (any object with supabase-js's `.from()` shape) so
// this file has no import of ../../lib/supabase and can be unit-tested in
// plain Node — see scripts/profileStats.test.mjs.

export const PROFILE_STATS_TIMEOUT_MS = 8000;

export const PROFILE_STATS_MESSAGES = {
  error: "Couldn't load your stats. Check your connection and try again.",
  timeout: 'Loading your stats took too long. Check your connection and try again.',
  invalid: "Your stats came back in an unexpected format. Try again, or contact us if it keeps happening.",
  missing: "Your profile isn't set up yet, so we can't show your stats. Try again later or contact us if it keeps happening.",
};

function isCount(value) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export async function fetchProfileStats(client, userId, { timeoutMs = PROFILE_STATS_TIMEOUT_MS } = {}) {
  if (!userId) return { status: 'error', message: PROFILE_STATS_MESSAGES.error };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const { data, error } = await client
      .from('profiles')
      .select('review_count, nav_count')
      .eq('id', userId)
      .abortSignal(controller.signal)
      .maybeSingle();

    if (error) {
      const timedOut = controller.signal.aborted || error.name === 'AbortError';
      return { status: 'error', message: timedOut ? PROFILE_STATS_MESSAGES.timeout : PROFILE_STATS_MESSAGES.error };
    }
    if (!data) return { status: 'missing', message: PROFILE_STATS_MESSAGES.missing };

    // Columns are `not null default 0`; anything else means the row/schema
    // isn't what we expect — don't coerce it into a plausible-looking 0.
    if (!isCount(data.review_count) || !isCount(data.nav_count)) {
      return { status: 'error', message: PROFILE_STATS_MESSAGES.invalid };
    }
    return { status: 'ready', reviews: data.review_count, navs: data.nav_count };
  } catch (err) {
    const timedOut = controller.signal.aborted || err?.name === 'AbortError';
    return { status: 'error', message: timedOut ? PROFILE_STATS_MESSAGES.timeout : PROFILE_STATS_MESSAGES.error };
  } finally {
    clearTimeout(timer);
  }
}

// What the two stat tiles display for each state.
export function statTileValue(stats, key) {
  if (stats.status === 'ready') return stats[key];
  if (stats.status === 'loading') return '…';
  return '—';
}
