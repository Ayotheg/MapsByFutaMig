// Tests for src/features/developers/developerData.js: the pure rules behind
// /developers and the admin API tab (formatting, credit meter, new-key
// limits, usage chart, error sentences, code samples).
// Run: node scripts/developerData.test.mjs
import assert from 'node:assert/strict';
import {
  API_BASE_URL,
  ENDPOINTS,
  FALLBACK_PRICING,
  apiErrorMessage,
  costFor,
  creditSummary,
  dayInitial,
  formatNaira,
  formatNumber,
  maskedPrefix,
  newKeyState,
  requestLabel,
  sampleCurl,
  sampleJs,
  shortDay,
  timeAgo,
  usageBars,
  validateKeyName,
} from '../src/features/developers/developerData.js';

// ── formatting
assert.equal(formatNumber(25000), '25,000');
assert.equal(formatNumber('1200'), '1,200');
assert.equal(formatNumber(null), '0');
assert.equal(formatNaira(3000), '₦3,000');
assert.equal(formatNaira(0), 'Free');
assert.equal(maskedPrefix('fk_live_2e02'), 'fk_live_2e02••••');

const now = new Date('2026-11-10T12:00:00Z');
assert.equal(shortDay('2026-12-10T06:00:00Z', now), '10 Dec');
assert.equal(shortDay('2027-01-03T06:00:00Z', now), '3 Jan 2027');
// Lagos is UTC+1: 23:30 UTC on the 9th is already the 10th there.
assert.equal(shortDay('2026-11-09T23:30:00Z', now), '10 Nov');
assert.equal(shortDay('nonsense', now), '');
assert.equal(timeAgo(null, now), 'never');
assert.equal(timeAgo('2026-11-10T11:59:40Z', now), 'just now');
assert.equal(timeAgo('2026-11-10T11:55:00Z', now), '5 min ago');
assert.equal(timeAgo('2026-11-10T09:00:00Z', now), '3 h ago');
assert.equal(timeAgo('2026-11-09T09:00:00Z', now), 'yesterday');
assert.equal(timeAgo('2026-11-06T09:00:00Z', now), '4 days ago');
assert.equal(timeAgo('2026-10-01T09:00:00Z', now), '1 Oct');
assert.equal(timeAgo('2026-11-10T12:00:30Z', now), 'just now', 'clock skew never goes negative');
assert.equal(dayInitial('2026-11-09'), 'M');
console.log('ok: developer formatting');

// ── credit meter
assert.deepEqual(creditSummary({ plan_credits: 750, topup_credits: 200, monthly_credits: 1000 }), {
  plan: 750, topup: 200, monthly: 1000, total: 950, planShare: 0.75, tone: 'ok',
});
assert.equal(creditSummary({ plan_credits: 50, topup_credits: 0, monthly_credits: 1000 }).tone, 'low');
assert.equal(creditSummary({ plan_credits: 0, topup_credits: 0, monthly_credits: 1000 }).tone, 'empty');
assert.equal(creditSummary({ plan_credits: 0, topup_credits: 5000, monthly_credits: 1000 }).tone, 'ok', 'top-ups count');
assert.equal(creditSummary({ plan_credits: 6000, monthly_credits: 5000 }).planShare, 1, 'never over 100%');
assert.equal(creditSummary({ plan_credits: '980', monthly_credits: '1000' }).total, 980, 'numeric strings');
assert.deepEqual(creditSummary(null), { plan: 0, topup: 0, monthly: 0, total: 0, planShare: 0, tone: 'empty' });
console.log('ok: credit meter');

// ── new-key rules mirror the database (one active Free key, five in all)
const key = (plan_id, status = 'active') => ({ plan_id, status });
assert.deepEqual(newKeyState([]), { allowed: true, reason: null });
assert.equal(newKeyState([key('free')]).allowed, false);
assert.match(newKeyState([key('free')]).reason, /one Free key/);
assert.equal(newKeyState([key('free', 'revoked')]).allowed, true, 'a revoked Free key frees the slot');
assert.equal(newKeyState([key('starter')]).allowed, true, 'after an upgrade, a new Free key is allowed');
assert.equal(newKeyState(Array.from({ length: 5 }, () => key('starter'))).allowed, false);
assert.match(newKeyState(Array.from({ length: 5 }, () => key('starter'))).reason, /5 active keys/);
assert.equal(validateKeyName(' '), 'Give the key a name, like the app it is for.');
assert.equal(validateKeyName('ab'), null);
assert.match(validateKeyName('x'.repeat(61)), /under 60/);
console.log('ok: new-key rules');

// ── usage chart: by credits, by calls when nothing was charged
const daily = [
  { day: '2026-11-08', calls: 4, credits: 0 },
  { day: '2026-11-09', calls: 10, credits: 10 },
  { day: '2026-11-10', calls: 2, credits: 5 },
];
assert.deepEqual(usageBars(daily).map((b) => b.height), [0, 1, 0.5]);
assert.deepEqual(usageBars(daily.map((d) => ({ ...d, credits: 0 }))).map((b) => b.height), [0.4, 1, 0.2]);
assert.deepEqual(usageBars([{ day: 'x', calls: 0, credits: 0 }]).map((b) => b.height), [0]);
assert.deepEqual(usageBars(null), []);
console.log('ok: usage chart');

// ── requests and prices
const plans = FALLBACK_PRICING.plans;
assert.equal(requestLabel({ kind: 'upgrade', plan_id: 'growth' }, plans), 'Upgrade to Growth');
assert.equal(requestLabel({ kind: 'upgrade', plan_id: 'gone' }, plans), 'Upgrade to gone');
assert.equal(requestLabel({ kind: 'topup', credits: 5000 }, plans), '5,000 more credits');
assert.equal(costFor(FALLBACK_PRICING.costs, 'GET /v1/places/:id/images'), 5);
assert.equal(costFor(FALLBACK_PRICING.costs, 'GET /v1/usage'), 0);
assert.equal(costFor([], 'GET /v1/places'), null);
// Every documented endpoint has a price, and the fallback matches the SQL seeds.
for (const ep of ENDPOINTS) assert.notEqual(costFor(FALLBACK_PRICING.costs, ep.pattern), null, ep.pattern);
assert.deepEqual(plans.map((p) => [p.id, p.price_ngn, p.monthly_credits, p.rate_limit]), [
  ['free', 0, 1000, 20],
  ['starter', 3000, 5000, 60],
  ['growth', 10000, 25000, 120],
]);
console.log('ok: requests and prices');

// ── code samples use the public address and never a real key
assert.equal(API_BASE_URL, 'https://mapsbyfuta.xyz/api/v1');
assert.match(sampleCurl(), /^curl "https:\/\/mapsbyfuta\.xyz\/api\/v1\/places\?type=hostel&limit=5" \\\n {2}-H "x-api-key: YOUR_API_KEY"$/);
assert.ok(sampleJs().includes('process.env.MAPS_BY_FUTA_KEY'));
assert.ok(!/supabase/i.test(sampleCurl() + sampleJs()), 'developers never see the Supabase address');
console.log('ok: code samples');

// ── database errors become sentences, never raw Postgres text
const err = (message, code) => ({ message, code });
assert.match(apiErrorMessage(err('free_key_exists')), /one Free key/);
assert.match(apiErrorMessage(err('key_limit')), /5 active keys/);
assert.match(apiErrorMessage(err('not_signed_in')), /Sign in again/);
assert.match(apiErrorMessage(err('not_admin')), /Admins only/);
assert.match(apiErrorMessage(err('request_open')), /already asked/);
assert.match(apiErrorMessage(err('Could not find the function public.api_dev_overview', 'PGRST202')), /public_api_dashboard\.sql/);
assert.match(apiErrorMessage(err('amount must be greater than 0')), /above 0/);
assert.match(apiErrorMessage(err('TypeError: Failed to fetch')), /connection/);
assert.equal(apiErrorMessage(err('relation "api_keys" does not exist at character 15')), 'Something went wrong. Try again.');
// "key_revoked" inside a longer word must not match a different code.
assert.match(apiErrorMessage(err('key_revoked')), /revoked/);
assert.equal(apiErrorMessage(null), null);
console.log('ok: error sentences');
