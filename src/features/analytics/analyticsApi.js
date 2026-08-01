import { supabase } from '../../lib/supabase';

// ── Slice 14 — Insights tab data layer ──────────────────────────────────
// Thin wrappers around the admin-only RPCs in supabase/analytics.sql.
// Every read here is gated server-side on is_admin() — these functions
// don't re-check admin status client-side, same trust model
// PendingTab.jsx already uses for submitter_display_names_admin_check.

export async function fetchRollup(daysBack = 30) {
  const { data, error } = await supabase.rpc('analytics_get_rollup', { days_back: daysBack });
  if (error) throw error;
  return data || [];
}

export async function fetchRecentSessions(limit = 50) {
  const { data, error } = await supabase.rpc('analytics_get_recent_sessions', { p_limit: limit });
  if (error) throw error;
  return data || [];
}

export async function fetchSessionEvents(sessionId, limit = 200) {
  const { data, error } = await supabase.rpc('analytics_get_events', {
    p_session_id: sessionId,
    p_limit: limit,
  });
  if (error) throw error;
  return data || [];
}

export async function fetchTableCounts() {
  const { data, error } = await supabase.rpc('analytics_table_counts');
  if (error) throw error;
  return data || [];
}

export async function fetchRecentSignups(limit = 10) {
  const { data, error } = await supabase.rpc('analytics_recent_signups', { p_limit: limit });
  if (error) throw error;
  return data || [];
}

/** Same "NetworkError with no HTTP status" → "table/migration not run
 * yet" heuristic quickChipsApi.js already established, reused here so
 * every Insights sub-tab surfaces the same plain-English message instead
 * of a raw Postgres/fetch error. */
export function describeError(e) {
  const raw = e?.message || String(e || 'Something went wrong.');
  if (/networkerror|failed to fetch|cors/i.test(raw)) {
    return `Couldn't reach the database (${raw}). Check that supabase/analytics.sql has been run.`;
  }
  if (/function .* does not exist/i.test(raw)) {
    return `Analytics tables/functions aren't set up yet — run supabase/analytics.sql against this project.`;
  }
  return raw;
}