// Tests for src/features/navigation/shortcutDetect.js and learnedShortcuts.js.
// Run: node scripts/learnedShortcuts.test.mjs. rpc/storage are mocks.
import assert from 'node:assert/strict';
import { haversine } from '../src/lib/geoUtils.js';
import { createTripTrace, findShortcuts, walkedPath, PRIVACY_TRIM_M, MAX_POINTS } from '../src/features/navigation/shortcutDetect.js';
import { createShortcutSharer, PENDING_KEY, PENDING_OUTCOMES_KEY, CONSENT_KEY } from '../src/features/navigation/learnedShortcuts.js';

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
  assert.equal(found[0].byVehicle, false);
  const [lat, lng] = found[0].path[0];
  assert.ok(haversine(A[0], A[1], lat, lng) >= PRIVACY_TRIM_M, 'never starts at the trip start');
  const [eLat, eLng] = found[0].path[found[0].path.length - 1];
  assert.ok(haversine(C[0], C[1], eLat, eLng) >= PRIVACY_TRIM_M, 'never ends at the destination');
  console.log('ok: corner shortcut found');
}

// ── the same corner cut by a shuttle or keke: counts, marked as a vehicle
{
  const corner = [7.298, 5.1386];
  const found = findShortcuts(route, trip([A, corner, { speed: 8 }], [corner, C, { stepM: 40, speed: 8 }]));
  assert.equal(found.length, 1, 'vehicle shortcut found');
  assert.equal(found[0].byVehicle, true);
  console.log('ok: vehicle shortcut found');
}

// ── trimming starts at the real starting point, not the first accurate fix
{
  const corner = [7.2981, 5.1381]; // leaves the road right at the start
  const points = trip([corner, C]);
  const origin = { lat: 7.2981, lng: 5.1384 }; // ~33 m east: where the trip really began
  const [first] = findShortcuts(route, points, { origin });
  assert.ok(haversine(origin.lat, origin.lng, first.path[0][0], first.path[0][1]) >= PRIVACY_TRIM_M);
  console.log('ok: trims around the real start');
}

// ── trimming never cuts the middle out of a path, and long paths keep their end
{
  const corner = [7.298, 5.1386];
  const points = trip([A, corner], [corner, C]);
  // Pretend the trip started beside the middle of the detour.
  const mid = points[Math.floor(points.length * 0.7)];
  const [s] = findShortcuts(route, points, { origin: { lat: mid.lat + 0.0001, lng: mid.lng } });
  for (let i = 1; i < s.path.length; i++) {
    const hop = haversine(s.path[i - 1][0], s.path[i - 1][1], s.path[i][0], s.path[i][1]);
    assert.ok(hop < 20, `no spliced jump in the shared path (got ${Math.round(hop)} m)`);
  }

  const long = trip([A, corner], [corner, C, { stepM: 1 }]); // ~1 m apart: far over MAX_POINTS
  const [l] = findShortcuts(route, long);
  assert.ok(l.path.length <= MAX_POINTS, 'thinned to the limit');
  const last = l.path[l.path.length - 1];
  const [normal] = findShortcuts(route, trip([A, corner], [corner, C]));
  const normalLast = normal.path[normal.path.length - 1];
  assert.ok(haversine(normalLast[0], normalLast[1], last[0], last[1]) < 15, 'ends where the same detour ends when not thinned');
  console.log('ok: trims only the ends, thins long paths');
}

// ── things that are not shortcuts
{
  assert.deepEqual(findShortcuts(route, trip([A, B], [B, C])), [], 'followed the route');

  const out = [7.2975, 5.1395]; // ~60 m south of the road, then back
  assert.deepEqual(findShortcuts(route, trip([A, [7.298, 5.139]], [[7.298, 5.139], out], [out, [7.298, 5.1405]], [[7.298, 5.1405], B], [B, C])), [], 'a detour that was longer');

  const corner = [7.298, 5.1386];
  assert.deepEqual(findShortcuts(route, trip([A, corner], [corner, C, { stepM: 80 }])), [], 'walking with GPS gaps too big to trust');
  assert.deepEqual(findShortcuts(route, trip([A, corner], [corner, C, { stepM: 250, speed: 10 }])), [], 'even in a vehicle, gaps over 200 m');
  assert.deepEqual(findShortcuts(route, [{ lat: A[0], lng: A[1], t: 0 }]), [], 'too few points');
  assert.deepEqual(findShortcuts(null, trip([A, B])), [], 'no route');
  console.log('ok: detours and gaps are ignored');
}

// ── sharing (signed-in users only)
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
      this.calls.push({ fn, ...args });
      assert.deepEqual(
        Object.keys(args),
        fn === 'submit_shortcut_walk'
          ? ['p_trip_id', 'p_seq', 'p_path', 'p_saved_m', 'p_by_vehicle']
          : ['p_shortcut_id', 'p_trip_id', 'p_used']
      );
      if (this.fail) return Promise.resolve({ data: null, error: { message: 'Failed to fetch' } });
      if (this.errorCode) return Promise.resolve({ data: null, error: { code: this.errorCode, message: 'bad' } });
      const key = `${fn}:${args.p_trip_id}:${args.p_seq ?? args.p_shortcut_id}`;
      const dup = seen.has(key);
      seen.add(key);
      return Promise.resolve({ data: { accepted: !dup, reason: dup ? 'duplicate' : null }, error: null });
    },
  };
}
const shortcuts = [
  { path: [[7.3, 5.14], [7.3005, 5.1405], [7.301, 5.141]], saved: 60, byVehicle: false },
  { path: [[7.299, 5.139], [7.2992, 5.1392], [7.2995, 5.1395]], saved: 70, byVehicle: true },
];

{
  const storage = memoryStorage();
  const server = fakeServer();
  const sharer = createShortcutSharer({ rpc: (f, a) => server.rpc(f, a), storage });
  assert.equal(sharer.consent('u1'), null, 'not asked yet');
  sharer.setConsent('u1', true);
  assert.equal(sharer.consent('u1'), true);
  assert.equal(sharer.consent('u2'), null, "another account on the same phone isn't covered by u1's answer");
  assert.equal(sharer.consent(null), null, 'guests are never sharing');
  assert.equal(storage.read(`${CONSENT_KEY}:u1`), true);

  assert.equal(await sharer.share('u1', 'trip-1', shortcuts), 2);
  assert.deepEqual(server.calls.map((c) => [c.p_trip_id, c.p_seq, c.p_by_vehicle]), [['trip-1', 0, false], ['trip-1', 1, true]]);
  assert.equal(storage._m.has(PENDING_KEY), false, 'nothing left queued');
  assert.equal(await sharer.share('u1', 'trip-1', []), 0, 'nothing to share');
  assert.equal(await sharer.share(null, 'trip-1', shortcuts), 0, 'guests never share');
  assert.equal(await sharer.share('u1', null, shortcuts), 0, 'no trip id');
  console.log('ok: shortcuts shared by signed-in users only');
}

{
  const storage = memoryStorage();
  const server = fakeServer();
  const errors = [];
  const sharer = createShortcutSharer({ rpc: (f, a) => server.rpc(f, a), storage, onError: (e) => errors.push(e) });
  server.fail = true;
  assert.equal(await sharer.share('u1', 'trip-1', shortcuts), 0);
  assert.equal(storage.read(PENDING_KEY, []).length, 2, 'queued for retry');
  assert.equal(errors.length, 2);
  assert.equal(await sharer.flush('u1'), 0, 'still offline');

  server.fail = false;
  assert.equal(await sharer.flush('u2'), 0, "another account never sends u1's shortcuts");
  assert.equal(storage.read(PENDING_KEY, []).length, 2);
  assert.equal(await sharer.flush('u1'), 2);
  assert.equal(storage._m.has(PENDING_KEY), false);
  assert.equal(await sharer.flush(null), 0);

  server.errorCode = '22023';
  assert.equal(await sharer.share('u1', 'trip-2', shortcuts.slice(0, 1)), 1, 'a permanent rejection is not retried');
  assert.equal(storage._m.has(PENDING_KEY), false);
  console.log('ok: failed shares are retried for the same user, rejected ones dropped');
}

// ── reporting whether learned shortcuts were taken
{
  const storage = memoryStorage();
  const server = fakeServer();
  const sharer = createShortcutSharer({ rpc: (f, a) => server.rpc(f, a), storage });
  assert.equal(await sharer.reportOutcomes('u1', 'trip-1', [{ shortcutId: 12, used: false }, { shortcutId: 13, used: true }]), 2);
  assert.deepEqual(
    server.calls.map((c) => [c.fn, c.p_shortcut_id, c.p_used]),
    [['report_shortcut_outcome', 12, false], ['report_shortcut_outcome', 13, true]]
  );
  assert.equal(await sharer.reportOutcomes('u1', 'trip-1', []), 0);
  assert.equal(await sharer.reportOutcomes(null, 'trip-1', [{ shortcutId: 12, used: false }]), 0, 'guests never report');

  server.fail = true;
  await sharer.reportOutcomes('u1', 'trip-2', [{ shortcutId: 12, used: false }]);
  assert.equal(storage.read(PENDING_OUTCOMES_KEY, []).length, 1, 'queued for retry');
  server.fail = false;
  assert.equal(await sharer.flush('u1'), 1);
  assert.equal(storage._m.has(PENDING_OUTCOMES_KEY), false);
  console.log('ok: shortcut outcomes reported and retried');
}

// ── walked it, or went around it?
{
  const shortcut = [[7.2981, 5.1381], [7.2995, 5.1395], [7.3009, 5.1409]];
  const along = trip([A, [7.2981, 5.1381]], [[7.2981, 5.1381], [7.3009, 5.1409]], [[7.3009, 5.1409], C]);
  const around = trip([A, B], [B, C]);
  assert.equal(walkedPath(shortcut, along), true, 'walked along it');
  assert.equal(walkedPath(shortcut, around), false, 'went round by the road');
  assert.equal(walkedPath(undefined, along), false, 'unknown shortcut');
  console.log('ok: walkedPath');
}
