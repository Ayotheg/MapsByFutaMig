// Pure helpers for /developers and the admin API tab: no React, no network,
// so scripts/developerData.test.mjs can test them in Node.

// Where developers send requests (vercel.json forwards it to the
// public-api Edge Function).
export const API_BASE_URL = 'https://mapsbyfuta.xyz/api/v1';

// Offered in "Buy credits". Free-form amounts are allowed by the database
// (500 to 1,000,000); these are just the quick picks.
export const TOPUP_OPTIONS = [2000, 5000, 10000, 25000];

export const NOTE_MAX = 500;
export const NAME_MIN = 2;
export const NAME_MAX = 60;

// Shown while pricing loads or if it can't load. Mirrors the seeds in
// supabase/public_api.sql; the live values replace these.
export const FALLBACK_PRICING = {
  plans: [
    { id: 'free', name: 'Free', price_ngn: 0, monthly_credits: 1000, rate_limit: 20 },
    { id: 'starter', name: 'Starter', price_ngn: 3000, monthly_credits: 5000, rate_limit: 60 },
    { id: 'growth', name: 'Growth', price_ngn: 10000, monthly_credits: 25000, rate_limit: 120 },
  ],
  costs: [
    { endpoint: 'GET /v1/usage', credits: 0 },
    { endpoint: 'GET /v1/categories', credits: 1 },
    { endpoint: 'GET /v1/places', credits: 1 },
    { endpoint: 'GET /v1/places/:id', credits: 1 },
    { endpoint: 'GET /v1/places/nearby', credits: 1 },
    { endpoint: 'GET /v1/places/:id/images', credits: 5 },
  ],
};

// The reference section. Costs come from the live price list.
export const ENDPOINTS = [
  {
    pattern: 'GET /v1/places',
    path: '/places',
    summary: 'Approved places, sorted by name.',
    params: [
      ['type', 'Category id from /categories, e.g. hostel'],
      ['q', 'Search name, area and type (up to 80 characters)'],
      ['limit', '1 to 50, default 20'],
      ['offset', '0 to 10000; use meta.pagination.next_offset'],
    ],
  },
  { pattern: 'GET /v1/places/:id', path: '/places/:id', summary: 'One place.', params: [] },
  {
    pattern: 'GET /v1/places/nearby',
    path: '/places/nearby',
    summary: 'Places around a point, nearest first, with distance_m.',
    params: [
      ['lat, lng', 'Required, decimal degrees'],
      ['radius_m', '1 to 5000, default 500'],
      ['type', 'Optional category id'],
      ['limit', '1 to 50, default 20'],
    ],
  },
  { pattern: 'GET /v1/categories', path: '/categories', summary: 'Every place type in use, with counts.', params: [] },
  {
    pattern: 'GET /v1/places/:id/images',
    path: '/places/:id/images',
    summary: 'Photos of a place: url (900px) and full_url (1600px). Check image_count first.',
    params: [],
  },
  { pattern: 'GET /v1/usage', path: '/usage', summary: 'Your plan, credits, reset date and last 20 calls.', params: [] },
];

export const ERROR_CODES = [
  ['400', 'bad_request', 'A parameter is missing or wrong'],
  ['401', 'missing_api_key / invalid_api_key', 'No key, or not a real key'],
  ['402', 'out_of_credits', 'No credits left for this call'],
  ['403', 'key_revoked', 'The key was revoked'],
  ['404', 'not_found', 'No such place or endpoint'],
  ['429', 'rate_limited', 'Too many calls this minute; see Retry-After'],
  ['500', 'server_error', 'Our fault, never charged; safe to retry'],
];

export function costFor(costs, pattern) {
  const hit = (costs || []).find((c) => c.endpoint === pattern);
  return hit ? Number(hit.credits) : null;
}

// ── Formatting ───────────────────────────────────────────────────────────

const int = new Intl.NumberFormat('en-NG');
export const formatNumber = (n) => int.format(Number(n) || 0);
export const formatNaira = (n) => (Number(n) ? `₦${int.format(Number(n))}` : 'Free');

// "fk_live_2e02" → "fk_live_2e02••••": enough to recognise, never the key.
export const maskedPrefix = (prefix) => `${prefix || 'fk_live_'}••••`;

/** "10 Dec" (or "10 Dec 2027" outside this year), Lagos time. */
export function shortDay(iso, now = new Date()) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const opts = { day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' };
  const year = (x) => x.toLocaleString('en-GB', { year: 'numeric', timeZone: 'Africa/Lagos' });
  if (year(d) !== year(now)) opts.year = 'numeric';
  return d.toLocaleDateString('en-GB', opts);
}

/** "just now", "5 min ago", "3 h ago", "2 days ago", then a date. */
export function timeAgo(iso, now = new Date()) {
  if (!iso) return 'never';
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return 'never';
  const s = Math.max(0, Math.round((now - then) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const days = Math.floor(s / 86400);
  if (days < 7) return days === 1 ? 'yesterday' : `${days} days ago`;
  return shortDay(iso, now);
}

/** Single-letter weekday for the usage chart, e.g. "M". */
export function dayInitial(day) {
  const d = new Date(`${day}T12:00:00+01:00`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { weekday: 'narrow', timeZone: 'Africa/Lagos' });
}

/** Everything a key card shows about credits. */
export function creditSummary(key) {
  const plan = Math.max(0, Number(key?.plan_credits) || 0);
  const topup = Math.max(0, Number(key?.topup_credits) || 0);
  const monthly = Math.max(0, Number(key?.monthly_credits) || 0);
  const total = plan + topup;
  // Share of this month's plan credits left; top-ups sit on top of it.
  const planShare = monthly ? Math.min(1, plan / monthly) : 0;
  let tone = 'ok';
  if (total === 0) tone = 'empty';
  else if (monthly && total < monthly * 0.1) tone = 'low';
  return { plan, topup, monthly, total, planShare, tone };
}

/** Bar heights (0–1) for the usage chart, by credits, then by calls. */
export function usageBars(daily) {
  const rows = Array.isArray(daily) ? daily : [];
  const credits = rows.map((d) => Number(d.credits) || 0);
  const calls = rows.map((d) => Number(d.calls) || 0);
  const series = credits.some(Boolean) ? credits : calls;
  const max = Math.max(0, ...series);
  return rows.map((d, i) => ({
    day: d.day,
    calls: calls[i],
    credits: credits[i],
    height: max ? series[i] / max : 0,
  }));
}

export function validateKeyName(name) {
  const n = String(name || '').trim();
  if (n.length < NAME_MIN) return 'Give the key a name, like the app it is for.';
  if (n.length > NAME_MAX) return `Keep the name under ${NAME_MAX} characters.`;
  return null;
}

/** What "New key" can do, given the account's keys. */
export function newKeyState(keys, limits = { max_active_keys: 5, max_free_keys: 1 }) {
  const active = (keys || []).filter((k) => k.status === 'active');
  if (active.length >= limits.max_active_keys) {
    return { allowed: false, reason: `You have ${limits.max_active_keys} active keys, the most an account can hold. Revoke one to make another.` };
  }
  if (active.some((k) => k.plan_id === 'free')) {
    return {
      allowed: false,
      reason: 'Each account gets one Free key. Upgrade it to add more keys, or roll it if it leaked.',
    };
  }
  return { allowed: true, reason: null };
}

export function requestLabel(req, plans = []) {
  if (req.kind === 'upgrade') {
    const plan = plans.find((p) => p.id === req.plan_id);
    return `Upgrade to ${plan ? plan.name : req.plan_id}`;
  }
  return `${formatNumber(req.credits)} more credits`;
}

// ── Code samples ─────────────────────────────────────────────────────────

export function sampleCurl(key = 'YOUR_API_KEY') {
  return `curl "${API_BASE_URL}/places?type=hostel&limit=5" \\\n  -H "x-api-key: ${key}"`;
}

export function sampleJs(key = 'YOUR_API_KEY') {
  return [
    `const res = await fetch("${API_BASE_URL}/places/nearby?lat=7.3003&lng=5.135&radius_m=500", {`,
    `  headers: { "x-api-key": process.env.MAPS_BY_FUTA_KEY ?? "${key}" },`,
    '});',
    'const { data, meta } = await res.json();',
    'console.log(data.length, "places,", meta.credits_remaining, "credits left");',
  ].join('\n');
}

// ── Errors from the database functions ───────────────────────────────────

const MESSAGES = {
  not_signed_in: 'Your session ended. Sign in again to continue.',
  not_admin: 'Admins only. Sign in with an admin account.',
  free_key_exists: 'Each account gets one Free key. Upgrade it to add more keys, or roll it if it leaked.',
  key_limit: 'You have 5 active keys, the most an account can hold. Revoke one to make another.',
  bad_name: 'Give the key a name between 2 and 60 characters.',
  free_plan_unavailable: 'New keys are paused right now. Try again later.',
  key_not_found: "That key wasn't found. Refresh the page.",
  key_revoked: 'That key has been revoked.',
  request_open: 'You already asked for this on this key. We will get back to you.',
  request_not_found: 'That request is already closed.',
  bad_plan: 'Pick a different plan.',
  bad_credits: 'Pick an amount between 500 and 1,000,000 credits.',
  bad_kind: 'Pick an upgrade or more credits.',
  note_too_long: `Keep the note under ${NOTE_MAX} characters.`,
  bad_status: 'That action is not allowed.',
};

/** A sentence for the user, from a Supabase RPC error. */
export function apiErrorMessage(error) {
  if (!error) return null;
  const text = String(error.message || error || '');
  if (error.code === 'PGRST202' || /could not find the function/i.test(text)) {
    return "The developer dashboard isn't set up yet. Run supabase/public_api_dashboard.sql.";
  }
  if (/amount must be greater than 0/.test(text)) return 'Enter a number of credits above 0.';
  if (/unknown plan/.test(text)) return 'That plan no longer exists.';
  for (const [code, message] of Object.entries(MESSAGES)) {
    if (new RegExp(`\\b${code}\\b`).test(text)) return message;
  }
  if (/failed to fetch|network/i.test(text)) return "Couldn't reach the server. Check your connection and try again.";
  return 'Something went wrong. Try again.';
}
