// Keeps /developers/docs honest: every example in
// src/features/developers/docsSamples.js is checked against the Public API's
// real rules and output shaping (supabase/functions/_shared/publicApi.ts).
// If the API changes, this fails until the docs are updated.
// Run: node scripts/docsSamples.test.mjs
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  ENDPOINT_SAMPLES,
  ERROR_GUIDE,
  EXAMPLE_ERROR,
  EXAMPLE_PLACE,
  RECIPES,
  json,
} from '../src/features/developers/docsSamples.js';
import { API_BASE_URL } from '../src/features/developers/developerData.js';

// publicApi.ts has no TypeScript-only syntax: import it as plain JS.
const dir = mkdtempSync(join(tmpdir(), 'docs-samples-'));
const copy = join(dir, 'publicApi.mjs');
writeFileSync(copy, readFileSync(new URL('../supabase/functions/_shared/publicApi.ts', import.meta.url), 'utf8'));
const api = await import(pathToFileURL(copy).href);
rmSync(dir, { recursive: true, force: true });
const handlerSrc = readFileSync(new URL('../supabase/functions/public-api/handler.ts', import.meta.url), 'utf8');

const PROXY = { imageProxyUrl: 'https://ik.imagekit.io/pk5x5zal3', supabaseUrl: 'https://example.supabase.co' };
const strip = (p) => Object.fromEntries(Object.entries(p).filter(([k]) => k !== 'distance_m'));

// ── every documented endpoint has samples in all three languages, and the
//    request in each one is valid for the real API
const patterns = Object.keys(api.DEFAULT_COSTS);
assert.deepEqual(Object.keys(ENDPOINT_SAMPLES).sort(), patterns.sort(), 'docs cover exactly the real endpoints');
for (const [pattern, s] of Object.entries(ENDPOINT_SAMPLES)) {
  for (const lang of ['curl', 'js', 'python']) {
    assert.ok(s[lang].includes(API_BASE_URL), `${pattern} ${lang}: public base URL`);
    assert.ok(!/supabase/i.test(s[lang]), `${pattern} ${lang}: never the Supabase address`);
    assert.ok(/x-api-key/.test(s[lang]), `${pattern} ${lang}: sends the key header`);
    assert.ok(!/fk_live_[0-9a-f]{48}/.test(s[lang]), `${pattern} ${lang}: no real-looking key`);
  }
  const url = new URL(s.curl.match(/"(https:[^"]+)"/)[1]);
  const route = api.matchRoute(url.pathname.replace(/^\/api/, ''));
  assert.equal(route?.pattern, pattern, `${pattern}: curl hits the right route`);
  if (route.name === 'places.list') assert.ok(!api.parseListParams(url.searchParams).error, 'list params valid');
  if (route.name === 'places.nearby') assert.ok(!api.parseNearbyParams(url.searchParams).error, 'nearby params valid');
  if (route.id) assert.ok(api.isPlaceId(route.id), `${pattern}: example id is a valid id`);
}
console.log('ok: docs samples hit real routes with valid parameters');

// ── example responses have exactly the fields the API sends
const meta = (m) => Object.keys(m).filter((k) => k !== 'pagination');
for (const [pattern, s] of Object.entries(ENDPOINT_SAMPLES)) {
  const { data, meta: m } = s.response;
  assert.deepEqual(meta(m), Object.keys(api.envelope(null).meta), `${pattern}: meta fields`);
  assert.equal(m.credits_charged, api.costFor(pattern, null), `${pattern}: credits_charged matches the default price`);
}
const places = [
  ...ENDPOINT_SAMPLES['GET /v1/places'].response.data,
  ENDPOINT_SAMPLES['GET /v1/places/:id'].response.data,
];
for (const p of places) assert.deepEqual(api.toPlace(p), p, `place ${p.name} is exactly what toPlace returns`);
for (const p of ENDPOINT_SAMPLES['GET /v1/places/nearby'].response.data) {
  assert.deepEqual(api.toPlace(p), p, `nearby ${p.name} shape`);
}
assert.deepEqual(api.toPlace(EXAMPLE_PLACE), EXAMPLE_PLACE);
for (const c of ENDPOINT_SAMPLES['GET /v1/categories'].response.data) {
  assert.deepEqual(api.toCategory({ type: c.id, place_count: c.place_count }), c, `category ${c.id}`);
}
for (const img of ENDPOINT_SAMPLES['GET /v1/places/:id/images'].response.data) {
  const path = new URL(img.url).pathname.replace(/^\/pk5x5zal3\//, '');
  assert.deepEqual(api.toImage({ storage_path: path, position: img.position }, PROXY), img, 'image URLs as the API builds them');
}
const usage = ENDPOINT_SAMPLES['GET /v1/usage'].response.data;
assert.deepEqual(Object.keys(usage), ['key', 'plan', 'credits', 'resets_at', 'recent_calls']);
for (const k of ['key:', 'plan:', 'credits:', 'resets_at:', 'recent_calls:', 'rate_limit_per_minute:', 'monthly_credits:', 'topup:', 'total:']) {
  assert.ok(handlerSrc.includes(k), `usage field ${k} exists in handler.ts`);
}
for (const call of usage.recent_calls) {
  assert.deepEqual(Object.keys(call), Object.keys(api.toUsageCall({})), 'recent call fields');
}
assert.equal(usage.credits.total, usage.credits.plan + usage.credits.topup);
assert.equal(usage.key.length, 12, 'only the 12-character prefix');
console.log('ok: docs responses match the real output shaping');

// ── the numbers in the examples add up
const list = ENDPOINT_SAMPLES['GET /v1/places'].response;
const pg = list.meta.pagination;
assert.equal(pg.limit, list.data.length);
assert.equal(pg.next_offset, pg.offset + list.data.length < pg.total ? pg.offset + list.data.length : null);
assert.deepEqual(list.data.map((p) => p.name), [...list.data.map((p) => p.name)].sort(), 'sorted by name');
// distance_m is the haversine distance from the example point, rounded.
const hav = (a, b, c, d) => {
  const r = (x) => (x * Math.PI) / 180;
  const h = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
};
const near = ENDPOINT_SAMPLES['GET /v1/places/nearby'];
const q = new URL(near.curl.match(/"(https:[^"]+)"/)[1]).searchParams;
let last = -1;
for (const p of near.response.data) {
  const d = Math.round(hav(Number(q.get('lat')), Number(q.get('lng')), p.lat, p.lng));
  assert.equal(p.distance_m, d, `${p.name} distance`);
  assert.ok(d <= Number(q.get('radius_m')), 'inside the radius');
  assert.ok(d >= last, 'nearest first');
  last = d;
}
console.log('ok: docs example numbers are consistent');

// ── errors: every code the API can send is documented, with the right status
const documented = Object.fromEntries(ERROR_GUIDE.map((e) => [e.code, e.status]));
const real = Object.fromEntries(Object.entries(api.ERRORS).map(([code, [status]]) => [code, status]));
assert.deepEqual(documented, real);
// The example error is word-for-word what the API says for limit=500.
const bad = api.parseListParams(new URLSearchParams('limit=500'));
assert.deepEqual(api.errorBody('bad_request', bad.error).body, EXAMPLE_ERROR);
console.log('ok: docs errors match the API');

// ── recipes use the public address, the env var, and real fields
for (const [name, code] of Object.entries(RECIPES)) {
  assert.ok(!/supabase/i.test(code), `${name}: no Supabase address`);
  assert.ok(!/fk_live_[0-9a-f]{48}/.test(code), `${name}: no real-looking key`);
}
for (const name of ['paginate', 'paginatePython', 'retry', 'proxyExpress', 'proxyNext']) {
  assert.ok(RECIPES[name].includes(API_BASE_URL), `${name}: public base URL`);
  assert.ok(RECIPES[name].includes('MAPS_BY_FUTA_KEY'), `${name}: key from the environment`);
}
assert.ok(RECIPES.paginate.includes('next_offset') && RECIPES.paginatePython.includes('next_offset'));
assert.ok(RECIPES.retry.includes('retry-after') && RECIPES.retry.includes('>= 500'));
assert.match(RECIPES.firstCall, /\/usage"/, 'first call is the free endpoint');
assert.equal(json({ a: 1 }), '{\n  "a": 1\n}');
console.log('ok: docs recipes');
