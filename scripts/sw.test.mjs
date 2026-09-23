// Logic tests for public/sw.js against a mocked Cache API + fetch.
// Run: node scripts/sw.test.mjs (Node 18+). Not a browser test.
import assert from 'node:assert/strict';

// ── minimal service-worker environment ──
const handlers = {};
const store = new Map(); // cacheName -> Map(url -> Response)
const mkCache = (name) => {
  if (!store.has(name)) store.set(name, new Map());
  const m = store.get(name);
  return {
    async match(k) { const r = m.get(typeof k === 'string' ? k : k.url); return r ? r.clone() : undefined; },
    async put(k, r) { const u = typeof k === 'string' ? k : k.url; m.delete(u); m.set(u, r); },
    async delete(k) { return m.delete(typeof k === 'string' ? k : k.url); },
    async keys() { return [...m.keys()].map((url) => ({ url })); },
  };
};
globalThis.caches = {
  open: async (n) => mkCache(n),
  keys: async () => [...store.keys()],
  delete: async (n) => store.delete(n),
};
globalThis.self = { addEventListener: (t, f) => (handlers[t] = f), skipWaiting() {}, clients: { claim: async () => {} } };

let fetchCalls = [];
let fetchImpl;
globalThis.fetch = (...a) => { fetchCalls.push(a); return fetchImpl(...a); };

await import('../public/sw.js');

const png = (n = 100) => new Uint8Array(n).fill(7);
const ok = (bytes, extra = {}) =>
  new Response(bytes, { status: 200, headers: { 'content-type': 'image/png', 'content-length': String(bytes.length), ...extra } });

async function req(url, { destination = 'image', method = 'GET', headers = {} } = {}) {
  const request = { url, method, destination, headers: new Headers(headers) };
  let p = null; const waits = [];
  const ev = { request, respondWith: (x) => (p = x), waitUntil: (x) => waits.push(x) };
  handlers.fetch(ev);
  const res = p ? await p : null;
  await Promise.all(waits);
  return res;
}
const cacheSize = (n) => store.get(n)?.size ?? 0;

const TILE = 'https://tile.openstreetmap.org/16/1/2.png';

// 1. miss → cors fetch → stored; hit → no network
fetchImpl = async () => ok(png());
let r = await req(TILE);
assert.equal(r.status, 200);
assert.equal(fetchCalls.length, 1);
assert.equal(fetchCalls[0][1].mode, 'cors');
assert.equal(fetchCalls[0][1].credentials, 'omit');
assert.equal(cacheSize('mbf-tiles-v2'), 1);
fetchCalls = [];
r = await req(TILE);
assert.equal(fetchCalls.length, 0, 'second load served from cache');
assert.equal((await r.arrayBuffer()).byteLength, 100);
console.log('ok 1: tile miss stores, hit served offline');

// 2. past default TTL (7d) + network dead → stale copy still served instantly
const age = (url, days) => {
  const m = store.get('mbf-tiles-v2'); const o = m.get(url);
  const h = new Headers(o.headers); h.set('x-sw-cached-at', String(Date.now() - days * 864e5));
  return o.blob().then((b) => m.set(url, new Response(b, { headers: h })));
};
await age(TILE, 8);
fetchImpl = async () => { throw new TypeError('network down'); };
r = await req(TILE);
assert.equal(r.status, 200, 'stale tile served when network fails');
console.log('ok 2: stale tile + dead network → stale copy');

// 3. stale (8d) + network up → stale served NOW, refreshed in background
await age(TILE, 8);
fetchImpl = async () => ok(png(50));
r = await req(TILE);
assert.equal((await r.arrayBuffer()).byteLength, 100, 'stale copy returned immediately');
const after = store.get('mbf-tiles-v2').get(TILE);
assert.equal((await after.clone().arrayBuffer()).byteLength, 50, 'background refresh stored new tile');
assert.ok(Date.now() - Number(after.headers.get('x-sw-cached-at')) < 5000);
console.log('ok 3: stale-while-revalidate');

// 3b. older than 30d + network up → must wait for network copy
await age(TILE, 31);
fetchImpl = async () => ok(png(60));
r = await req(TILE);
assert.equal((await r.arrayBuffer()).byteLength, 60);
console.log('ok 3b: >30d old tile requires network');

// 3c. server Cache-Control max-age is honoured
const T3 = 'https://tile.openstreetmap.org/16/5/5.png';
fetchImpl = async () => ok(png(), { 'cache-control': 'public, max-age=3600' });
await req(T3);
assert.equal(store.get('mbf-tiles-v2').get(T3).headers.get('x-sw-ttl-ms'), '3600000');
fetchCalls = []; await req(T3);
assert.equal(fetchCalls.length, 0, 'fresh within max-age: no network');
await age(T3, 0.1); // 2.4h old > 1h max-age → background revalidate
fetchCalls = []; await req(T3);
assert.equal(fetchCalls.length, 1, 'past max-age: revalidates');
fetchImpl = async () => ok(png(), { 'cache-control': 'max-age=0' });
const T4 = 'https://tile.openstreetmap.org/16/6/6.png';
await req(T4);
fetchCalls = []; await req(T4);
assert.equal(fetchCalls.length, 1, 'max-age=0 always revalidates');
console.log('ok 3c: Cache-Control max-age honoured (incl. 0)');

// 4. cap + oldest-first eviction
fetchImpl = async () => ok(png());
for (let i = 0; i < 650; i++) await req(`https://tile.openstreetmap.org/17/${i}/0.png`);
assert.ok(cacheSize('mbf-tiles-v2') <= 600, 'cap respected: ' + cacheSize('mbf-tiles-v2'));
assert.ok(!store.get('mbf-tiles-v2').has('https://tile.openstreetmap.org/17/0/0.png'), 'oldest evicted');
assert.ok(store.get('mbf-tiles-v2').has('https://tile.openstreetmap.org/17/649/0.png'), 'newest kept');
console.log('ok 4: tile cap =', cacheSize('mbf-tiles-v2'), '(oldest evicted)');

// 5. CORS refused, no cache → falls back to plain browser fetch, nothing stored
const T2 = 'https://server.arcgisonline.com/x/1/2/3';
let n = 0;
fetchImpl = async (a, o) => { n++; if (o && o.mode === 'cors') throw new TypeError('cors'); return ok(png()); };
const before = cacheSize('mbf-tiles-v2');
r = await req(T2);
assert.equal(r.status, 200); assert.equal(n, 2);
assert.equal(cacheSize('mbf-tiles-v2'), before);
console.log('ok 5: no-CORS host falls back, not cached');

// 6. 403 block tile passes through, never cached
fetchImpl = async () => new Response(png(), { status: 403, headers: { 'content-type': 'image/png' } });
r = await req('https://tile.openstreetmap.org/18/9/9.png');
assert.equal(r.status, 403);
assert.ok(!store.get('mbf-tiles-v2').has('https://tile.openstreetmap.org/18/9/9.png'));
console.log('ok 6: 403 not cached');

// 7. photos: small cached, big / unknown-size not
const P = (f) => `https://abc.supabase.co/storage/v1/object/public/place-images/waypoint/1/${f}.jpg`;
fetchImpl = async () => ok(png(200_000));
await req(P('small'));
assert.ok(store.get('mbf-photos-v2').has(P('small')));
fetchImpl = async () => ok(png(3_000_000));
await req(P('big'));
assert.ok(!store.get('mbf-photos-v2').has(P('big')));
fetchImpl = async () => new Response(png(1000), { status: 200, headers: { 'content-type': 'image/jpeg' } });
await req(P('nolen'));
assert.ok(!store.get('mbf-photos-v2').has(P('nolen')));
fetchCalls = [];
fetchImpl = async () => { throw new Error('should not hit network'); };
r = await req(P('small')); assert.equal(r.status, 200);
console.log('ok 7: photo size rules + cache hit');

// 8. photo cap
fetchImpl = async () => ok(png(1000));
for (let i = 0; i < 60; i++) await req(P('p' + i));
assert.ok(cacheSize('mbf-photos-v2') <= 40);
console.log('ok 8: photo cap =', cacheSize('mbf-photos-v2'));

// 9. things it must NOT touch
assert.equal(await req('https://abc.supabase.co/rest/v1/waypoints', { destination: 'empty' }), null);
assert.equal(await req(TILE, { method: 'POST' }), null);
assert.equal(await req(TILE, { headers: { range: 'bytes=0-9' } }), null);
assert.equal(await req('https://example.com/a.png'), null);
assert.equal(await req('https://abc.supabase.co/storage/v1/object/public/other-bucket/a.png'), null);
console.log('ok 9: API calls, POST, range, other hosts/buckets untouched');

// 10. activate drops old-version caches only
store.set('mbf-tiles-v0', new Map()); store.set('other-app', new Map());
let w; await handlers.activate({ waitUntil: (p) => (w = p) }); await w;
assert.ok(!store.has('mbf-tiles-v0')); assert.ok(store.has('other-app')); assert.ok(store.has('mbf-tiles-v2'));
console.log('ok 10: activate cleans old mbf-* caches only');
