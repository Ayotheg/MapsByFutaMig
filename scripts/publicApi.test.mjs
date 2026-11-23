// Tests for the Public API (supabase/functions/public-api): the pure rules in
// _shared/publicApi.ts, the request handler against an in-memory fake of the
// database, and store.ts's queries (which tables and columns it may touch).
// Run: node scripts/publicApi.test.mjs
//
// The .ts files have no TypeScript-only syntax, so they're copied to
// temporary .mjs files and imported as plain JavaScript (no Deno needed).
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(tmpdir(), 'public-api-'));
const sources = {};
for (const file of ['_shared/publicApi', 'public-api/handler', 'public-api/store']) {
  const src = readFileSync(new URL(`../supabase/functions/${file}.ts`, import.meta.url), 'utf8');
  sources[file] = src;
  mkdirSync(join(dir, file.split('/')[0]), { recursive: true });
  writeFileSync(join(dir, `${file}.mjs`), src.replace(/(from\s+'[^']+)\.ts'/g, "$1.mjs'"));
}
const load = (file) => import(pathToFileURL(join(dir, `${file}.mjs`)).href);
const api = await load('_shared/publicApi');
const { createHandler } = await load('public-api/handler');
const { createStore } = await load('public-api/store');
rmSync(dir, { recursive: true, force: true });

// ═══ 1. Pure rules ════════════════════════════════════════════════════════

// ── key hashing matches Postgres' encode(sha256(...), 'hex')
const KEY = `fk_live_${'a1b2c3d4'.repeat(6)}`;
assert.equal(await api.sha256Hex(KEY), createHash('sha256').update(KEY).digest('hex'));
assert.equal((await api.sha256Hex(KEY)).length, 64);
assert.ok(api.isKeyFormat(KEY));
for (const bad of ['', 'fk_live_short', 'sk_live_' + 'a'.repeat(48), `${KEY}!`, null, 42]) {
  assert.equal(api.isKeyFormat(bad), false, `not a key: ${bad}`);
}
// ── a key is never printable in full
assert.equal(api.maskKey(KEY), 'fk_live_a1b2…');
assert.ok(!api.maskKey(KEY).includes(KEY.slice(12)));
assert.equal(api.maskKey('whatever-they-sent'), '(malformed)');

// ── routing (the function sees its own name before /v1)
const route = (p) => api.matchRoute(p);
assert.equal(route('/public-api/v1/places').pattern, 'GET /v1/places');
assert.equal(route('/v1/places/').pattern, 'GET /v1/places');
assert.equal(route('/functions/v1/public-api/v1/places/p2').id, 'p2');
assert.equal(route('/public-api/v1/places/nearby').pattern, 'GET /v1/places/nearby');
assert.deepEqual(route('/public-api/v1/places/abc123'), { pattern: 'GET /v1/places/:id', name: 'places.detail', id: 'abc123' });
assert.equal(route('/public-api/v1/places/abc123/images').pattern, 'GET /v1/places/:id/images');
assert.equal(route('/public-api/v1/categories').pattern, 'GET /v1/categories');
assert.equal(route('/public-api/v1/usage').pattern, 'GET /v1/usage');
for (const p of ['/public-api', '/public-api/v1', '/public-api/v2/places', '/public-api/v1/users', '/public-api/v1/places/a/b/c']) {
  assert.equal(route(p), null, `no route: ${p}`);
}

// ── cost lookup: database first, defaults if the row is missing or broken
assert.equal(api.costFor('GET /v1/places', { 'GET /v1/places': 3 }), 3);
assert.equal(api.costFor('GET /v1/places/:id/images', {}), 5);
assert.equal(api.costFor('GET /v1/places/:id/images', null), 5);
assert.equal(api.costFor('GET /v1/usage', { 'GET /v1/usage': 0 }), 0);
assert.equal(api.costFor('GET /v1/usage', { 'GET /v1/usage': 3 }), 0, 'usage is free whatever the price list says');
assert.equal(api.costFor('GET /v1/places', { 'GET /v1/places': -2 }), 1);
assert.equal(api.costFor('GET /v1/places', { 'GET /v1/places': 'abc' }), 1);

// ── charge-or-not: only a 2xx with a price
assert.equal(api.shouldCharge(200, 1), true);
assert.equal(api.shouldCharge(200, 0), false);
for (const status of [400, 401, 402, 403, 404, 405, 429, 500]) assert.equal(api.shouldCharge(status, 5), false);

// ── params
const qs = (s) => new URLSearchParams(s);
assert.deepEqual(api.parseListParams(qs('')).value, { limit: 20, offset: 0, type: null, q: null });
assert.deepEqual(api.parseListParams(qs('limit=50&offset=100&type=Hostel&q= cafe ')).value, {
  limit: 50, offset: 100, type: 'hostel', q: 'cafe',
});
for (const bad of ['limit=51', 'limit=0', 'limit=abc', 'limit=-1', 'offset=-1', 'offset=1.5', 'offset=10001', 'type=food;drop', `q=${'x'.repeat(81)}`, 'q=a%00b']) {
  assert.ok(api.parseListParams(qs(bad)).error, `rejected: ${bad}`);
}
assert.deepEqual(api.parseNearbyParams(qs('lat=7.3&lng=5.135')).value, {
  lat: 7.3, lng: 5.135, radius_m: 500, limit: 20, type: null,
});
assert.equal(api.parseNearbyParams(qs('lat=7.3&lng=5.135&radius_m=5000')).value.radius_m, 5000);
for (const bad of ['', 'lat=7.3', 'lat=abc&lng=5', 'lat=91&lng=5', 'lat=7&lng=181', 'lat=7&lng=5&radius_m=5001', 'lat=7&lng=5&radius_m=0', 'lat=1e2&lng=5']) {
  assert.ok(api.parseNearbyParams(qs(bad)).error, `rejected: ${bad}`);
}
assert.ok(api.isPlaceId('0Ab_9-xyz'));
for (const bad of ['', 'a b', "a'--", 'a/b', 'x'.repeat(65)]) assert.equal(api.isPlaceId(bad), false);
// ── search wildcards are made literal
assert.equal(api.likePattern('50%_Off*'), '%50\\%\\_off %');

// ── column allow-list: named columns only, nothing private
const PRIVATE = /submitted_by|user_id|email|phone|status|rejection|source_type|created_by|is_admin|sponsor|promo|is_person|is_channel|is_business|channel_link|business_link|segment_id|pin_locked|explore/;
for (const cols of [api.PLACE_COLUMNS, api.IMAGE_COLUMNS, api.CATEGORY_COLUMNS]) {
  assert.ok(!cols.includes('*'), 'never SELECT *');
  assert.ok(!PRIVATE.test(cols), `no private column in: ${cols}`);
}
assert.equal(api.PLACE_COLUMNS, 'id, name, description, type, area, lat, lng, rating, review_count, image_count');

// ── output shaping drops anything not on the list, and fixes numeric strings
const dirtyRow = {
  id: 'p1', name: 'SUB Cafeteria', description: null, type: 'food', area: 'SUB area',
  lat: '7.3000', lng: '5.1350', rating: '4.5', review_count: 2, image_count: 2,
  submitted_by: 'user-uuid', status: 'approved', sponsor_name: 'Secret', is_promoted: true,
  email: 'someone@example.com', search_text: 'sub cafeteria',
};
assert.deepEqual(api.toPlace(dirtyRow), {
  id: 'p1', name: 'SUB Cafeteria', description: null, type: 'food', area: 'SUB area',
  lat: 7.3, lng: 5.135, rating: 4.5, review_count: 2, image_count: 2,
});
assert.equal(api.toPlace({ ...dirtyRow, rating: null }).rating, null);
assert.equal(api.toPlace({ ...dirtyRow, distance_m: 156.62 }).distance_m, 157);
assert.deepEqual(api.toCategory({ type: 'lecture_hall', place_count: '14' }), { id: 'lecture_hall', label: 'Lecture hall', place_count: 14 });

// ── image URLs: proxy if set, else public storage; never another folder
const PROXY = { imageProxyUrl: 'https://ik.imagekit.io/demo/', supabaseUrl: 'https://proj.supabase.co' };
assert.deepEqual(api.imageUrls('waypoints/p1/a b.jpg', PROXY), {
  url: 'https://ik.imagekit.io/demo/waypoints/p1/a%20b.jpg?tr=w-900,c-at_max,q-75,f-auto',
  full_url: 'https://ik.imagekit.io/demo/waypoints/p1/a%20b.jpg?tr=w-1600,c-at_max,q-80,f-auto',
});
assert.equal(
  api.imageUrls('waypoint/1/x.jpg', { imageProxyUrl: '', supabaseUrl: 'https://proj.supabase.co/' }).url,
  'https://proj.supabase.co/storage/v1/object/public/place-images/waypoint/1/x.jpg'
);
// a stored "?" or "#" stays part of the file name, not the URL's query
assert.equal(
  api.imageUrls('waypoints/p1/a?tr=w-9#x.jpg', PROXY).url,
  'https://ik.imagekit.io/demo/waypoints/p1/a%3Ftr%3Dw-9%23x.jpg?tr=w-900,c-at_max,q-75,f-auto'
);
for (const path of ['promotion/9/secret.jpg', 'event/9/poster.jpg', 'waypoints/../promotion/9/a.jpg', '', null, 'private/x.jpg']) {
  assert.equal(api.imageUrls(path, PROXY), null, `not served: ${path}`);
}
assert.deepEqual(Object.keys(api.toImage({ id: 7, place_id: 'p1', storage_path: 'waypoints/p1/a.jpg', position: 1 }, PROXY)), ['position', 'url', 'full_url']);

// ── envelope and errors
assert.deepEqual(api.envelope([1], { creditsCharged: 1, creditsRemaining: 9, rateLimitRemaining: 19 }), {
  data: [1], meta: { credits_charged: 1, credits_remaining: 9, rate_limit_remaining: 19 },
});
assert.deepEqual(api.errorBody('out_of_credits').status, 402);
assert.deepEqual(api.errorBody('bad_request', 'limit must be a whole number.'), {
  status: 400, body: { error: { code: 'bad_request', message: 'limit must be a whole number.' } },
});
const codes = Object.fromEntries(Object.entries(api.ERRORS).map(([code, [status]]) => [code, status]));
assert.deepEqual(codes, {
  missing_api_key: 401, invalid_api_key: 401, out_of_credits: 402, key_revoked: 403, not_found: 404,
  method_not_allowed: 405, rate_limited: 429, bad_request: 400, server_error: 500,
});
// ── rate-limit headers
assert.deepEqual(api.rateHeaders({ limit: 20, remaining: -3, retryAfter: 12.2 }), {
  'X-RateLimit-Limit': '20', 'X-RateLimit-Remaining': '0', 'Retry-After': '13',
});
assert.deepEqual(api.rateHeaders({ limit: 20, remaining: 5 }), { 'X-RateLimit-Limit': '20', 'X-RateLimit-Remaining': '5' });
assert.equal(api.clientIp(new Headers({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' })), '1.2.3.4');
assert.equal(api.clientIp(new Headers()), 'unknown');

console.log('ok: public API rules (keys, routes, costs, params, allow-list, envelope)');

// ═══ 2. The handler against a fake database ═══════════════════════════════
// Mirrors what supabase/public_api.sql does: per-minute counters, plan
// credits spent before top-up, and an all-or-nothing consume.

const hash = (s) => createHash('sha256').update(s).digest('hex');
const KEYS = {
  good: `fk_live_${'1'.repeat(48)}`,
  revoked: `fk_live_${'2'.repeat(48)}`,
  unknown: `fk_live_${'9'.repeat(48)}`,
};
const IP_LIMIT = 10;

function makeDb() {
  return {
    plan: { id: 'free', name: 'Free', monthly_credits: 1000, rate_limit_per_minute: 20 },
    keys: [
      { id: 'key-good', key_hash: hash(KEYS.good), key_prefix: KEYS.good.slice(0, 12), status: 'active', plan: 100, topup: 0, hits: 0 },
      { id: 'key-revoked', key_hash: hash(KEYS.revoked), key_prefix: KEYS.revoked.slice(0, 12), status: 'revoked', plan: 100, topup: 0, hits: 0 },
    ],
    ipHits: {},
    usage: [],
    costs: { 'GET /v1/places': 1, 'GET /v1/places/:id': 1, 'GET /v1/places/nearby': 1, 'GET /v1/categories': 1, 'GET /v1/places/:id/images': 5, 'GET /v1/usage': 0 },
    places: [
      { ...dirtyRow },
      { id: 'p2', name: 'Main Library', description: 'Quiet', type: 'library', area: null, lat: '7.3010', lng: '5.1360', rating: null, review_count: 0, image_count: 0, submitted_by: 'user-2' },
    ],
    images: [
      { id: 1, place_id: 'p1', storage_path: 'waypoints/p1/a.jpg', position: 0 },
      { id: 2, place_id: 'p1', storage_path: 'promotion/zz/leak.jpg', position: 1 },
    ],
    failFetch: false,
    seenHashes: [],
  };
}

function makeStore(db) {
  return {
    async authorize(keyHash, ipHash) {
      db.seenHashes.push(keyHash);
      const k = db.keys.find((r) => r.key_hash === keyHash);
      if (!k || k.status !== 'active') {
        const n = (db.ipHits[ipHash] = (db.ipHits[ipHash] || 0) + 1);
        const status = n > IP_LIMIT ? 'ip_rate_limited' : k ? 'revoked' : 'invalid';
        return { status, key_id: k ? k.id : null, rate_limit: IP_LIMIT, rate_remaining: Math.max(IP_LIMIT - n, 0), retry_after: 30 };
      }
      k.hits += 1;
      const limit = db.plan.rate_limit_per_minute;
      return {
        status: k.hits > limit ? 'rate_limited' : 'ok',
        key_id: k.id, key_prefix: k.key_prefix, plan_id: db.plan.id, plan_name: db.plan.name,
        monthly_credits: db.plan.monthly_credits, rate_limit: limit, rate_remaining: Math.max(limit - k.hits, 0),
        retry_after: 30, plan_credits_remaining: k.plan, topup_credits_remaining: k.topup,
        credits_remaining: k.plan + k.topup, period_reset_at: '2026-12-10T00:00:00+00:00', costs: db.costs,
      };
    },
    async listPlaces({ type, q, limit, offset }) {
      if (db.failFetch) throw new Error('database is down');
      const all = db.places.filter((p) => (!type || p.type === type) && (!q || p.name.toLowerCase().includes(q.toLowerCase())));
      return { rows: all.slice(offset, offset + limit), total: all.length };
    },
    async getPlace(id) { return db.places.find((p) => p.id === id) || null; },
    async nearbyPlaces() { return db.places.map((p, i) => ({ ...p, distance_m: i * 156.6 })); },
    async categories() { return [{ type: 'food', place_count: 1 }, { type: 'library', place_count: 1 }]; },
    async placeImages(id) { return db.images.filter((i) => i.place_id === id); },
    async consumeCredits(keyId, cost) {
      // Yield first, like a real round trip: lets parallel requests interleave.
      await new Promise((r) => setTimeout(r, 1));
      const k = db.keys.find((r) => r.id === keyId);
      if (k.status !== 'active') return { revoked: true };
      if (k.plan + k.topup < cost) return { insufficient: true };
      const fromPlan = Math.min(k.plan, cost);
      k.plan -= fromPlan;
      k.topup -= cost - fromPlan;
      return { plan_credits_remaining: k.plan, topup_credits_remaining: k.topup, credits_remaining: k.plan + k.topup };
    },
    async logUsage(row) { db.usage.push({ ...row, created_at: new Date().toISOString() }); },
    async recentUsage(keyId) { return db.usage.filter((u) => u.key_id === keyId).slice(-20).reverse(); },
  };
}

let db = makeDb();
const logged = [];
const quietLog = { error: (...args) => logged.push(args.join(' ')) };
const newHandler = () => createHandler({ store: makeStore(db), config: PROXY, log: quietLog });
let handler = newHandler();
const reset = () => { db = makeDb(); handler = newHandler(); logged.length = 0; };

async function call(path, { key = KEYS.good, method = 'GET', ip = '41.0.0.1' } = {}) {
  const headers = { 'x-forwarded-for': ip };
  if (key) headers['x-api-key'] = key;
  const res = await handler(new Request(`https://x.supabase.co/functions/v1/public-api${path}`, { method, headers }));
  const text = await res.text();
  return { status: res.status, headers: res.headers, text, json: text ? JSON.parse(text) : null };
}
const credits = () => { const k = db.keys[0]; return k.plan + k.topup; };
const lastLog = () => db.usage[db.usage.length - 1];

// ── no key → 401
let r = await call('/v1/places', { key: null });
assert.equal(r.status, 401);
assert.equal(r.json.error.code, 'missing_api_key');
assert.equal(r.json.data, undefined);
// ── wrong key → 401
r = await call('/v1/places', { key: KEYS.unknown });
assert.equal(r.status, 401);
assert.equal(r.json.error.code, 'invalid_api_key');
assert.equal(r.headers.get('X-RateLimit-Limit'), String(IP_LIMIT));
// ── malformed key → 401, and its text never reaches the database
r = await call('/v1/places', { key: "' or 1=1 --" });
assert.equal(r.status, 401);
assert.equal(db.seenHashes.at(-1), '');
assert.equal(credits(), 100, 'failed auth never charges');

// ── revoked key → 403
r = await call('/v1/places', { key: KEYS.revoked });
assert.equal(r.status, 403);
assert.equal(r.json.error.code, 'key_revoked');
assert.equal(db.keys[1].plan, 100);
assert.equal(r.headers.get('X-RateLimit-Limit'), String(IP_LIMIT), 'rate headers on a 403 too');
assert.ok(r.headers.get('X-RateLimit-Remaining') !== null);

// ── valid key, places list → 200, charges 1
reset();
r = await call('/v1/places');
assert.equal(r.status, 200);
assert.equal(r.json.data.length, 2);
assert.deepEqual(r.json.meta, {
  credits_charged: 1, credits_remaining: 99, rate_limit_remaining: 19,
  pagination: { limit: 20, offset: 0, total: 2, next_offset: null },
});
assert.equal(credits(), 99);
assert.equal(r.headers.get('X-RateLimit-Limit'), '20');
assert.equal(r.headers.get('X-RateLimit-Remaining'), '19');
assert.equal(r.headers.get('Access-Control-Allow-Origin'), '*');
assert.equal(r.headers.get('Cache-Control'), 'no-store');
assert.deepEqual(lastLog(), { key_id: 'key-good', endpoint: 'GET /v1/places', status_code: 200, credits_charged: 1, response_ms: lastLog().response_ms, created_at: lastLog().created_at });
// ── no user data in any response field, even though the rows carry some
assert.ok(!/submitted_by|user-uuid|user-2|someone@example\.com|sponsor|Secret|status|search_text/.test(r.text), 'no private field leaks');
assert.deepEqual(Object.keys(r.json.data[0]), ['id', 'name', 'description', 'type', 'area', 'lat', 'lng', 'rating', 'review_count', 'image_count']);
assert.equal(typeof r.json.data[0].lat, 'number');

// ── paging
r = await call('/v1/places?limit=1');
assert.equal(r.json.data.length, 1);
assert.equal(r.json.meta.pagination.next_offset, 1);
// ── an empty result from a valid query IS charged
const before = credits();
r = await call('/v1/places?q=zzzz-nothing');
assert.equal(r.status, 200);
assert.deepEqual(r.json.data, []);
assert.equal(r.json.meta.credits_charged, 1);
assert.equal(credits(), before - 1);

// ── one place, nearby, categories → 1 credit each
reset();
r = await call('/v1/places/p2');
assert.equal(r.status, 200);
assert.equal(r.json.data.name, 'Main Library');
r = await call('/v1/places/nearby?lat=7.3&lng=5.135&radius_m=500');
assert.equal(r.status, 200);
assert.equal(r.json.data[1].distance_m, 157);
r = await call('/v1/categories');
assert.deepEqual(r.json.data[0], { id: 'food', label: 'Food', place_count: 1 });
assert.equal(credits(), 97);

// ── image request → charges 5, and only place photos come back
reset();
r = await call('/v1/places/p1/images');
assert.equal(r.status, 200);
assert.equal(r.json.meta.credits_charged, 5);
assert.equal(credits(), 95);
assert.equal(r.json.data.length, 1, 'the promotion/ upload is not served');
assert.ok(r.json.data[0].url.startsWith('https://ik.imagekit.io/demo/waypoints/p1/a.jpg'));
assert.ok(!r.text.includes('storage_path') && !r.text.includes('promotion/'));
assert.equal(lastLog().credits_charged, 5);
// ── the price list is read from the database, not the code
db.costs['GET /v1/places/:id/images'] = 8;
r = await call('/v1/places/p1/images');
assert.equal(r.json.meta.credits_charged, 8);

// ── bad param → 400, charges 0
reset();
for (const path of ['/v1/places?limit=500', '/v1/places/nearby?lat=abc&lng=5', '/v1/places/nearby', '/v1/places/bad%20id']) {
  r = await call(path);
  assert.equal(r.status, 400, path);
  assert.equal(r.json.error.code, 'bad_request');
}
assert.equal(credits(), 100);
assert.equal(lastLog().status_code, 400);
assert.equal(lastLog().credits_charged, 0);

// ── unknown place → 404, charges 0 (for the place and for its images)
for (const path of ['/v1/places/nope', '/v1/places/nope/images', '/v1/nothing-here']) {
  r = await call(path);
  assert.equal(r.status, 404, path);
  assert.equal(r.json.error.code, 'not_found');
}
assert.equal(credits(), 100);
assert.equal(lastLog().credits_charged, 0);

// ── writes are refused, uncharged
r = await call('/v1/places', { method: 'POST' });
assert.equal(r.status, 405);
assert.equal(credits(), 100);
assert.equal(lastLog().endpoint, 'POST /v1/places');

// ── our own failure → 500, charges 0
db.failFetch = true;
r = await call('/v1/places');
assert.equal(r.status, 500);
assert.equal(r.json.error.code, 'server_error');
assert.equal(credits(), 100);
assert.ok(logged.some((line) => line.includes('database is down')));
db.failFetch = false;

// ── OPTIONS: CORS only, nothing counted or logged
const logsBefore = db.usage.length;
const hitsBefore = db.keys[0].hits;
r = await call('/v1/places', { method: 'OPTIONS', key: null });
assert.equal(r.status, 204);
assert.ok(r.headers.get('Access-Control-Allow-Headers').includes('x-api-key'));
assert.equal(db.usage.length, logsBefore);
assert.equal(db.keys[0].hits, hitsBefore);

// ── /v1/usage → 0 credits, shows the caller's own plan and calls
reset();
await call('/v1/places');
r = await call('/v1/usage');
assert.equal(r.status, 200);
assert.equal(r.json.meta.credits_charged, 0);
assert.equal(credits(), 99);
assert.equal(r.json.data.plan.name, 'Free');
assert.deepEqual(r.json.data.credits, { plan: 99, topup: 0, total: 99 });
assert.equal(r.json.data.resets_at, '2026-12-10T00:00:00+00:00');
assert.equal(r.json.data.recent_calls[0].endpoint, 'GET /v1/places');
assert.equal(r.json.data.key, 'fk_live_1111');
assert.ok(!r.text.includes(KEYS.good), 'the full key is never echoed');
assert.ok(!r.text.includes('key_hash') && !r.text.includes('key-good'));

// ── credits exhausted → 402, no data
reset();
db.keys[0].plan = 0;
r = await call('/v1/places');
assert.equal(r.status, 402);
assert.equal(r.json.error.code, 'out_of_credits');
assert.equal(r.json.data, undefined);
// 4 credits can't buy a 5-credit image call, and aren't partly taken
db.keys[0].plan = 4;
r = await call('/v1/places/p1/images');
assert.equal(r.status, 402);
assert.equal(credits(), 4);
// usage still works with no credits
r = await call('/v1/usage');
assert.equal(r.status, 200);

// ── plan credits are spent before top-up credits
reset();
db.keys[0].plan = 2;
db.keys[0].topup = 10;
r = await call('/v1/places/p1/images');
assert.equal(r.status, 200);
assert.deepEqual([db.keys[0].plan, db.keys[0].topup], [0, 7]);
assert.equal(r.json.meta.credits_remaining, 7);

// ── two parallel requests with 1 credit left → only one succeeds
reset();
db.keys[0].plan = 1;
const pair = await Promise.all([call('/v1/places'), call('/v1/places/p2')]);
assert.deepEqual(pair.map((x) => x.status).sort(), [200, 402]);
const loser = pair.find((x) => x.status === 402);
assert.equal(loser.json.data, undefined, 'the loser gets no data');
assert.equal(credits(), 0);
assert.deepEqual(db.usage.map((u) => u.credits_charged).sort(), [0, 1]);

// ── burst over the rate limit → 429 with Retry-After, not charged
reset();
const burst = [];
for (let i = 0; i < 25; i++) burst.push(await call('/v1/usage'));
assert.equal(burst.filter((x) => x.status === 200).length, 20);
assert.equal(burst.filter((x) => x.status === 429).length, 5);
const limited = burst.at(-1);
assert.equal(limited.json.error.code, 'rate_limited');
assert.equal(limited.headers.get('Retry-After'), '30');
assert.equal(limited.headers.get('X-RateLimit-Remaining'), '0');
assert.equal(credits(), 100);
assert.equal(lastLog().status_code, 429);

// ── a key revoked between the check and the charge → 403, no data, no charge
reset();
const realStore = makeStore(db);
handler = createHandler({
  store: { ...realStore, listPlaces: async (p) => { db.keys[0].status = 'revoked'; return realStore.listPlaces(p); } },
  config: PROXY, log: quietLog,
});
r = await call('/v1/places');
assert.equal(r.status, 403);
assert.equal(r.json.data, undefined);
assert.equal(db.keys[0].plan, 100);

// ── a revoked key can't hammer the API or its log: counted per IP
reset();
const revokedBurst = [];
for (let i = 0; i < 14; i++) revokedBurst.push(await call('/v1/places', { key: KEYS.revoked, ip: '55.5.5.5' }));
assert.deepEqual(revokedBurst.map((x) => x.status), [...Array(10).fill(403), 429, 429, 429, 429]);
assert.equal(db.usage.length, 10);

// ── key guessing: the 11th wrong key from one IP is blocked; none are logged
reset();
const guesses = [];
for (let i = 0; i < 12; i++) guesses.push(await call('/v1/places', { key: `fk_live_${String(i).padStart(48, '0')}`, ip: '66.6.6.6' }));
assert.deepEqual(guesses.map((x) => x.status), [...Array(10).fill(401), 429, 429]);
assert.ok(guesses.at(-1).headers.get('Retry-After'));
assert.equal(db.usage.length, 0, 'strangers cannot fill the usage log');
// another IP, and a real key from the blocked IP, are unaffected
assert.equal((await call('/v1/places', { key: KEYS.unknown, ip: '77.7.7.7' })).status, 401);
assert.equal((await call('/v1/places', { ip: '66.6.6.6' })).status, 200);

// ── a full key is never logged, even when things break
reset();
// (an empty answer from the key check is a clean 500 too)
handler = createHandler({ store: { ...makeStore(db), authorize: async () => null }, config: PROXY, log: quietLog });
assert.equal((await call('/v1/places')).status, 500);
logged.length = 0;
const brokenStore = { ...makeStore(db), authorize: async () => { throw new Error('boom'); } };
handler = createHandler({ store: brokenStore, config: PROXY, log: quietLog });
r = await call('/v1/places');
assert.equal(r.status, 500);
assert.ok(logged.length > 0);
assert.ok(!logged.some((line) => line.includes(KEYS.good)), 'logs carry the masked key only');
assert.ok(logged.some((line) => line.includes('fk_live_1111…')));

console.log('ok: public API handler (auth, charging, 402 race, rate limits, no leaks)');

// ═══ 3. store.ts: what the API is allowed to touch ════════════════════════

const touched = { tables: new Set(), selects: [], rpcs: new Set(), inserts: [] };
function fakeClient() {
  const builder = (table) => {
    touched.tables.add(table);
    const q = {
      select(cols) { touched.selects.push([table, cols]); return q; },
      insert(row) { touched.inserts.push([table, row]); return Promise.resolve({ error: null }); },
      eq() { return q; }, ilike() { return q; }, order() { return q; }, limit() { return q; },
      range() { return q; },
      maybeSingle() { return Promise.resolve({ data: null, error: null }); },
      then(ok, bad) { return Promise.resolve({ data: [], error: null, count: 0 }).then(ok, bad); },
    };
    return q;
  };
  return {
    from: builder,
    rpc(name) {
      touched.rpcs.add(name);
      return Promise.resolve(name === 'consume_credits' ? { data: null, error: { message: 'insufficient_credits' } } : { data: [], error: null });
    },
  };
}
const store = createStore(fakeClient());
await store.authorize('h', 'ip');
await store.listPlaces({ type: 'food', q: 'x', limit: 5, offset: 0 });
await store.getPlace('p1');
await store.nearbyPlaces({ lat: 1, lng: 2, radius_m: 3, type: null, limit: 5 });
await store.categories();
await store.placeImages('p1');
await store.logUsage({ key_id: 'k', endpoint: 'GET /v1/places', status_code: 200, credits_charged: 1, response_ms: 3 });
await store.recentUsage('k');
assert.deepEqual(await store.consumeCredits('k', 1), { insufficient: true });

assert.deepEqual([...touched.tables].sort(), ['api_public_categories', 'api_public_place_images', 'api_public_places', 'api_usage']);
assert.deepEqual([...touched.rpcs].sort(), ['api_authorize', 'api_places_nearby', 'consume_credits']);
for (const [table, cols] of touched.selects) {
  assert.ok(typeof cols === 'string' && cols.length > 0 && !cols.includes('*'), `${table}: named columns only`);
}
assert.deepEqual(Object.keys(touched.inserts[0][1]).sort(), ['credits_charged', 'endpoint', 'key_id', 'response_ms', 'status_code']);

// ── the API code never names a private table, and never logs a raw key
const FORBIDDEN = /auth\.users|\bprofiles\b|\breviews\b|analytics_|\bevents\b|\bpromotions?\b|promotion_images|waypoint_submission|submission_log|navigation_completions|friends|marketing|bachs_webhook/i;
for (const [file, src] of Object.entries(sources)) {
  const code = src.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
  // "promotion/" appears once, as a folder the image check refuses.
  assert.ok(!FORBIDDEN.test(code.replace(/Promotion and event uploads/g, '')), `${file} touches no private table`);
  assert.ok(!/\.from\(\s*['"`](?!api_)/.test(code), `${file} only reads api_* objects`);
  assert.ok(!/select\(\s*['"`]\*/.test(code), `${file} never selects *`);
  assert.ok(!/log\.\w+\([^)]*\bapiKey\b(?!\))/.test(code.replace(/maskKey\(apiKey\)/g, '')), `${file} never logs the raw key`);
}

console.log('ok: public API store (only api_* views, named columns, no private tables)');
