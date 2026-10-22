// Tests for src/features/navigation/shortcutDetect.js and learnedShortcuts.js.
// Run: node scripts/learnedShortcuts.test.mjs. rpc/storage are mocks.
import assert from 'node:assert/strict';
import { haversine } from '../src/lib/geoUtils.js';
import { createTripTrace, findShortcuts, PRIVACY_TRIM_M } from '../src/features/navigation/shortcutDetect.js';
import { createShortcutSharer, PENDING_KEY, CONSENT_KEY } from '../src/features/navigation/learnedShortcuts.js';

// Route: ~330 m east, then ~330 m north (A → B → C). ~110 m per 0.001°.
const A = [7.298, 5.138];
const B = [7.298, 5.141];
const C = [7.301, 5.141];
const route = [A, B, C];

// Points every ~stepM from a to b, walking at `speed` m/s from time t0.
function walk(a, b, { stepM = 10, speed = 1.4, t0 = 0 } = {}) {
  const d = haversine(a[0], a[1], b[0], b[1]);
  const n = Math.max(1, Math.round(d / stepM));
  return Array.from({ length: n + 1 }, (_, i) => ({
    lat: a[0] + ((b[0] - a[0]) * i) / n,
    lng: a[1] + ((b[1] - a[1]) * i) / n,
    t: t0 + ((d * i) / n / speed) * 1000,
  }));
}
function trip(...legs) {
  const points = [];
  let t0 = 0;
  for (const [a, b, opts] of legs) {
    const pts = walk(a, b, { ...opts, t0 });
    points.push(...(points.length ? pts.slice(1) : pts));
    t0 = points[points.length - 1].t;
  }
  return points;
}

// ── trace keeps accurate fixes a few metres apart
{
  const trace = createTripTrace();
  trace.add({ lat: 7.298, lng: 5.138, accuracy: 5, t: 0 });
  trace.add({ lat: 7.29801, lng: 5.138, accuracy: 5, t: 1 }); // ~1 m: dropped
  trace.add({ lat: 7.2981, lng: 5.138, accuracy: 60, t: 2 }); // too inaccurate
  trace.add({ lat: 7.2981, lng: 5.138, accuracy: 10, t: 3 });
  assert.equal(trace.points.length, 2);
  console.log('ok: trip trace');
}

// ── a real shortcut: along the road a bit, then across the corner to C
{
  const corner = [7.298, 5.1386];
  const found = findShortcuts(route, trip([A, corner], [corner, C]));
  assert.equal(found.length, 1, 'one shortcut');
  assert.ok(found[0].saved > 100, `saves ~180 m, got ${found[0].saved}`);
  assert.ok(found[0].length > 300 && found[0].length < 450, `about 400 m long, got ${found[0].length}`);
  const [lat, lng] = found[0].path[0];
  assert.ok(haversine(A[0], A[1], lat, lng) >= PRIVACY_TRIM_M, 'never starts at the trip start');
  console.log('ok: corner shortcut found');
}

// ── things that are not shortcuts
{
  assert.deepEqual(findShortcuts(route, trip([A, B], [B, C])), [], 'followed the route');

  const out = [7.2975, 5.1395]; // ~60 m south of the road, then back
  assert.deepEqual(findShortcuts(route, trip([A, [7.298, 5.139]], [[7.298, 5.139], out], [out, [7.298, 5.1405]], [[7.298, 5.1405], B], [B, C])), [], 'a detour that was longer');

  const corner = [7.298, 5.1386];
  assert.deepEqual(findShortcuts(route, trip([A, corner], [corner, C, { speed: 8 }])), [], 'on a bus, not walking');
  assert.deepEqual(findShortcuts(route, trip([A, corner], [corner, C, { stepM: 80 }])), [], 'GPS gaps too big to trust');
  assert.deepEqual(findShortcuts(route, [{ lat: A[0], lng: A[1], t: 0 }]), [], 'too few points');
  assert.deepEqual(findShortcuts(null, trip([A, B])), [], 'no route');
  console.log('ok: detours, rides and gaps are ignored');
}

// ── sharing
function memoryStorage() {
  const m = new Map();
  return {
    read: (k, fb) => (m.has(k) ? JSON.parse(m.get(k)) : fb),
    write: (k, v) => m.set(k, JSON.stringify(v)),
    remove: (k) => m.delete(k),
    _m: m,
  };
}
function fakeServer() {
  const seen = new Set();
  return {
    calls: [],
    fail: false,
    errorCode: null,
    rpc(fn, args) {
      this.calls.push(args);
      assert.equal(fn, 'submit_shortcut_walk');
      assert.deepEqual(Object.keys(args), ['p_trip_id', 'p_seq', 'p_path', 'p_saved_m', 'p_anon_id']);
      if (this.fail) return Promise.resolve({ data: null, error: { message: 'Failed to fetch' } });
      if (this.errorCode) return Promise.resolve({ data: null, error: { code: this.errorCode, message: 'bad' } });
      const key = `${args.p_anon_id}:${args.p_trip_id}:${args.p_seq}`;
      const dup = seen.has(key);
      seen.add(key);
      return Promise.resolve({ data: { accepted: !dup, reason: dup ? 'duplicate' : null }, error: null });
    },
  };
}
const shortcuts = [{ path: [[7.3, 5.14], [7.301, 5.141]], saved: 50 }, { path: [[7.299, 5.139], [7.2995, 5.1395]], saved: 40 }];

{
  const storage = memoryStorage();
  const server = fakeServer();
  const sharer = createShortcutSharer({ rpc: (f, a) => server.rpc(f, a), storage, anonId: () => 'anon-1' });
  assert.equal(sharer.consent(), null, 'not asked yet');
  sharer.setConsent(true);
  assert.equal(storage.read(CONSENT_KEY), true);

  assert.equal(await sharer.share('trip-1', shortcuts), 2);
  assert.deepEqual(server.calls.map((c) => [c.p_trip_id, c.p_seq, c.p_anon_id]), [['trip-1', 0, 'anon-1'], ['trip-1', 1, 'anon-1']]);
  assert.equal(storage._m.has(PENDING_KEY), false, 'nothing left queued');
  assert.equal(await sharer.share('trip-1', []), 0, 'nothing to share');
  assert.equal(await sharer.share(null, shortcuts), 0, 'no trip id');
  console.log('ok: shortcuts shared with the anonymous id');
}

{
  const storage = memoryStorage();
  const server = fakeServer();
  const errors = [];
  const sharer = createShortcutSharer({ rpc: (f, a) => server.rpc(f, a), storage, anonId: () => 'anon-1', onError: (e) => errors.push(e) });
  server.fail = true;
  assert.equal(await sharer.share('trip-1', shortcuts), 0);
  assert.equal(storage.read(PENDING_KEY, []).length, 2, 'queued for retry');
  assert.equal(errors.length, 2);
  assert.equal(await sharer.flush(), 0, 'still offline');

  server.fail = false;
  assert.equal(await sharer.flush(), 2);
  assert.equal(storage._m.has(PENDING_KEY), false);

  server.errorCode = '22023';
  assert.equal(await sharer.share('trip-2', shortcuts.slice(0, 1)), 1, 'a permanent rejection is not retried');
  assert.equal(storage._m.has(PENDING_KEY), false);
  console.log('ok: failed shares are retried, rejected ones dropped');
}
