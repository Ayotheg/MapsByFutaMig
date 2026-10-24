// Tests for src/features/navigation/shortcutDetect.js and learnedShortcuts.js.
// Run: node scripts/learnedShortcuts.test.mjs. rpc/storage are mocks.
import assert from 'node:assert/strict';
import { haversine, routePosition } from '../src/lib/geoUtils.js';
import { createTripTrace, findShortcuts, walkedPath, MAX_POINTS } from '../src/features/navigation/shortcutDetect.js';
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

// ── trace keeps accurate fixes a few metres apart, and can be restored
{
  const trace = createTripTrace();
  assert.equal(trace.add({ lat: 7.298, lng: 5.138, accuracy: 5, t: 0 }), true);
  assert.equal(trace.add({ lat: 7.29801, lng: 5.138, accuracy: 5, t: 1 }), false, '~1 m: dropped');
  assert.equal(trace.add({ lat: 7.2981, lng: 5.138, accuracy: 60, t: 2 }), false, 'too inaccurate');
  assert.equal(trace.add({ lat: 7.2981, lng: 5.138, accuracy: 30, t: 3 }), true, '30 m accuracy is good enough');
  assert.equal(trace.points.length, 2);

  const restored = createTripTrace(trace.points.slice());
  assert.equal(restored.add({ lat: 7.2982, lng: 5.138, accuracy: 5, t: 4 }), true);
  assert.equal(restored.points.length, 3, 'a restored trace carries on');

  const full = createTripTrace();
  for (let k = 0; k < 3005; k++) full.add({ lat: 7.28 + k * 0.0001, lng: 5.13, accuracy: 5, t: k });
  assert.equal(full.points.length, 3000, 'capped');
  console.log('ok: trip trace');
}

// The side-street case: along the road a bit, cut across to the second
// road, rejoin it, carry on to the destination.
const corner = [7.298, 5.1386]; // ~66 m along the first road
const rejoin = [7.3, 5.141]; // ~220 m up the second road
const cutAcross = (opts) => trip([A, corner, opts], [corner, rejoin, opts], [rejoin, C, opts]);

// ── a real shortcut: shared from road to road
{
  const stats = {};
  const found = findShortcuts(route, cutAcross(), { stats });
  assert.equal(found.length, 1, 'one shortcut');
  assert.ok(found[0].saved > 100, `saves ~150 m, got ${found[0].saved}`);
  assert.equal(found[0].byVehicle, false);
  for (const end of [found[0].path[0], found[0].path[found[0].path.length - 1]]) {
    const r = routePosition(route, end[0], end[1]);
    assert.ok(r.offRouteMeters < 1, `starts and ends on the route itself (off by ${r.offRouteMeters.toFixed(1)} m)`);
  }
  assert.deepEqual([stats.offRuns, stats.noRejoin, stats.gaps, stats.notShorter], [1, 0, 0, 0]);
  console.log('ok: side-street shortcut found, road to road');
}

// ── GPS wobble doesn't hide it
{
  const wobbly = cutAcross().map((p, k) => ({ ...p, lat: p.lat + (k % 2 ? 0.00006 : -0.00006) })); // ±6–7 m zig-zag
  const [clean] = findShortcuts(route, cutAcross());
  const [noisy] = findShortcuts(route, wobbly);
  assert.ok(noisy, 'still found');
  assert.ok(Math.abs(noisy.saved - clean.saved) < 30, `similar saving: ${noisy.saved} vs ${clean.saved}`);
  console.log('ok: GPS wobble');
}

// ── the same cut in a vehicle: counts, marked as a vehicle
{
  const found = findShortcuts(route, cutAcross({ speed: 8, stepM: 40 }));
  assert.equal(found.length, 1);
  assert.equal(found[0].byVehicle, true);
  console.log('ok: vehicle shortcut found');
}

// ── long paths are thinned, still road to road
{
  const [l] = findShortcuts(route, cutAcross({ stepM: 1 }));
  assert.ok(l.path.length <= MAX_POINTS, 'thinned to the limit');
  const r = routePosition(route, l.path[l.path.length - 1][0], l.path[l.path.length - 1][1]);
  assert.ok(r.offRouteMeters < 1, 'still ends on the route');
  console.log('ok: long paths thinned');
}

// ── things that are not shared
{
  const stats = {};
  assert.deepEqual(findShortcuts(route, trip([A, corner], [corner, C]), { stats }), [], 'cuts straight to the destination');
  assert.equal(stats.noRejoin + stats.nearStartOrEnd, 1, 'refused: it ends where they arrived');
  const offRoad = [...trip([A, corner], [corner, [7.3005, 5.1395]])]; // arrives ~120 m from the route's end
  assert.deepEqual(findShortcuts(route, offRoad, { stats }), [], 'never comes back to the route');
  assert.equal(stats.noRejoin, 1);

  const fromStart = trip([[7.2981, 5.1381], rejoin], [rejoin, C]);
  assert.deepEqual(findShortcuts(route, fromStart, { origin: { lat: 7.2981, lng: 5.1381 }, stats }), [], 'leaves the road where the trip started');
  assert.equal(stats.nearStartOrEnd, 1);

  assert.deepEqual(findShortcuts(route, trip([A, B], [B, C])), [], 'followed the route');

  const out = [7.2975, 5.1395]; // ~60 m south of the road, then back
  assert.deepEqual(findShortcuts(route, trip([A, [7.298, 5.139]], [[7.298, 5.139], out], [out, [7.298, 5.1405]], [[7.298, 5.1405], B], [B, C]), { stats }), [], 'a detour that was longer');
  assert.equal(stats.notShorter, 1);

  assert.deepEqual(findShortcuts(route, cutAcross({ stepM: 120 }), { stats }), [], 'walking with GPS gaps too big to trust');
  assert.equal(stats.gaps, 1);
  assert.deepEqual(findShortcuts(route, cutAcross({ stepM: 250, speed: 10 })), [], 'even in a vehicle, gaps over 200 m');
  assert.deepEqual(findShortcuts(route, [{ lat: A[0], lng: A[1], t: 0 }]), [], 'too few points');
  assert.deepEqual(findShortcuts(null, trip([A, B])), [], 'no route');
  console.log('ok: detours, gaps and private ends are not shared');
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
