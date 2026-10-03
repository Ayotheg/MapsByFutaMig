// Tests for src/features/navigation/navTrip.js and navCompletion.js.
// Run: node scripts/navCompletion.test.mjs (Node 18+). rpc/storage are mocks.
import assert from 'node:assert/strict';
import { claimCompletion, createTripId, restoreTrip } from '../src/features/navigation/navTrip.js';
import {
  createNavCompletionRecorder,
  PENDING_KEY,
  MAX_PENDING,
  MAX_PENDING_AGE_MS,
} from '../src/features/navigation/navCompletion.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// ── trip ids
assert.match(createTripId(), UUID_RE);
assert.match(createTripId({}), UUID_RE, 'fallback generator yields a v4 uuid');
assert.notEqual(createTripId(), createTripId());
console.log('ok: trip ids are unique v4 UUIDs (with fallback)');

// ── once-per-trip gate: duplicate arrival callbacks
{
  const trip = { tripId: 'a', completionReported: false };
  assert.equal(claimCompletion(trip), true, 'first arrival counts');
  assert.equal(claimCompletion(trip), false, 'duplicate arrival callback does not');
  assert.equal(claimCompletion(trip), false);
  assert.equal(claimCompletion(null), false);
}
console.log('ok: completion is claimed exactly once per trip');

// ── restored session: reload after arrival must not re-report
{
  const saved = { tripId: 'trip-1', completionReported: true };
  const restored = restoreTrip(saved);
  assert.deepEqual(restored, saved);
  assert.equal(claimCompletion(restored), false, 'reloaded already-reported trip stays reported');

  const midTrip = restoreTrip({ tripId: 'trip-2', completionReported: false });
  assert.equal(claimCompletion(midTrip), true, 'reloaded mid-trip can still complete once');
  assert.equal(claimCompletion(midTrip), false);

  // older persisted session with no tripId, or no session at all
  const legacy = restoreTrip({ active: true }, () => 'fresh-id');
  assert.deepEqual(legacy, { tripId: 'fresh-id', completionReported: false });
  assert.equal(restoreTrip(null, () => 'n').tripId, 'n');
  assert.equal(restoreTrip({ tripId: '', completionReported: 'yes' }, () => 'g').completionReported, false, 'only literal true counts');
}
console.log('ok: restored sessions keep their reported flag; legacy sessions get a fresh id');

// ── recorder
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
  // Mirrors record_navigation_completion's idempotency: (user, trip) once.
  const seen = new Set();
  let count = 0;
  return {
    get count() { return count; },
    calls: 0,
    fail: false,
    rpc(fn, args) {
      this.calls++;
      assert.equal(fn, 'record_navigation_completion');
      assert.deepEqual(Object.keys(args), ['p_trip_id']);
      if (this.fail) return Promise.resolve({ data: null, error: { message: 'Failed to fetch' } });
      if (seen.has(args.p_trip_id)) return Promise.resolve({ data: { counted: false, reason: 'duplicate' }, error: null });
      seen.add(args.p_trip_id); count++;
      return Promise.resolve({ data: { counted: true, nav_count: count }, error: null });
    },
  };
}

// success path
{
  const storage = memoryStorage(); const server = fakeServer();
  const rec = createNavCompletionRecorder({ rpc: (f, a) => server.rpc(f, a), storage });
  const res = await rec.report('u1', 'trip-a');
  assert.equal(res.counted, true);
  assert.equal(server.count, 1);
  assert.equal(storage._m.has(PENDING_KEY), false, 'nothing left queued after success');
}
console.log('ok: successful report counts once and leaves nothing queued');

// repeated report of the same trip counts once
{
  const storage = memoryStorage(); const server = fakeServer();
  const rec = createNavCompletionRecorder({ rpc: (f, a) => server.rpc(f, a), storage });
  await rec.report('u1', 'trip-a');
  await rec.report('u1', 'trip-a');
  await Promise.all([rec.report('u1', 'trip-a'), rec.report('u1', 'trip-a')]);
  assert.equal(server.count, 1);
}
console.log('ok: repeated/concurrent reports of one trip count once');

// failure -> queued -> retried later, still once
{
  const storage = memoryStorage(); const server = fakeServer();
  const errors = [];
  const rec = createNavCompletionRecorder({ rpc: (f, a) => server.rpc(f, a), storage, onError: (e) => errors.push(e) });
  server.fail = true;
  assert.equal(await rec.report('u1', 'trip-a'), false);
  assert.equal(errors.length, 1);
  assert.equal(server.count, 0, 'failed call counts nothing');
  assert.equal(storage.read(PENDING_KEY, []).length, 1, 'queued for retry');

  // still offline: flush stops and keeps the entry
  assert.equal(await rec.flush('u1'), 0);
  assert.equal(storage.read(PENDING_KEY, []).length, 1);

  server.fail = false;
  assert.equal(await rec.flush('u1'), 1);
  assert.equal(server.count, 1);
  assert.equal(storage._m.has(PENDING_KEY), false);
  assert.equal(await rec.flush('u1'), 0, 'nothing left to retry');
  assert.equal(server.count, 1, 'retry never double counts');
}
console.log('ok: failed completion is queued, retried once online, counted exactly once');

// queue is per-user: another account's trips are never sent as this user
{
  const storage = memoryStorage(); const server = fakeServer();
  const rec = createNavCompletionRecorder({ rpc: (f, a) => server.rpc(f, a), storage });
  server.fail = true;
  await rec.report('u1', 'trip-a');
  server.fail = false;
  assert.equal(await rec.flush('u2'), 0);
  assert.equal(server.count, 0, "u2's flush does not send u1's trip");
  assert.equal(storage.read(PENDING_KEY, []).length, 1);
  assert.equal(await rec.flush('u1'), 1);
}
console.log('ok: pending completions are only flushed for the user they belong to');

// ignores missing ids rather than counting blindly
{
  const server = fakeServer();
  const rec = createNavCompletionRecorder({ rpc: (f, a) => server.rpc(f, a), storage: memoryStorage() });
  assert.equal(await rec.report(null, 'trip'), false);
  assert.equal(await rec.report('u1', undefined), false);
  assert.equal(await rec.flush(null), 0);
  assert.equal(server.calls, 0);
}
console.log('ok: missing user/trip id never reaches the server');

// queue bounds: cap and expiry
{
  const storage = memoryStorage(); const server = fakeServer();
  let t = 1_000_000;
  const rec = createNavCompletionRecorder({ rpc: (f, a) => server.rpc(f, a), storage, now: () => t });
  server.fail = true;
  for (let i = 0; i < MAX_PENDING + 5; i++) await rec.report('u1', `trip-${i}`);
  assert.equal(storage.read(PENDING_KEY, []).length, MAX_PENDING, 'queue is capped');
  t += MAX_PENDING_AGE_MS + 1;
  server.fail = false;
  assert.equal(await rec.flush('u1'), 0, 'expired entries are dropped, not sent');
  assert.equal(server.count, 0);
}
console.log('ok: pending queue is capped and expires old entries');
