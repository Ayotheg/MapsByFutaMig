// Tests for src/features/auth/profileStats.js and src/features/auth/signOut.js.
// Run: node scripts/profileStats.test.mjs (Node 18+). No browser / Supabase needed:
// the supabase-js client is replaced by a minimal chainable mock.
import assert from 'node:assert/strict';
import {
  fetchProfileStats,
  statTileValue,
  PROFILE_STATS_MESSAGES,
} from '../src/features/auth/profileStats.js';
import { signOutOrThrow, SIGN_OUT_FAILED_MESSAGE } from '../src/features/auth/signOut.js';

// Mock of supabase.from('profiles').select().eq().abortSignal().maybeSingle()
function mockClient(respond) {
  const calls = {};
  const builder = {
    select(cols) { calls.select = cols; return builder; },
    eq(col, val) { calls.eq = [col, val]; return builder; },
    abortSignal(sig) { calls.signal = sig; return builder; },
    maybeSingle() { return Promise.resolve().then(() => respond(calls)); },
  };
  return { calls, from(table) { calls.table = table; return builder; } };
}

// ── ready: real counters, including genuine zeros
{
  const c = mockClient(() => ({ data: { review_count: 3, nav_count: 7 }, error: null }));
  const r = await fetchProfileStats(c, 'user-1');
  assert.deepEqual(r, { status: 'ready', reviews: 3, navs: 7 });
  assert.equal(c.calls.table, 'profiles');
  assert.equal(c.calls.select, 'review_count, nav_count');
  assert.deepEqual(c.calls.eq, ['id', 'user-1']);
  const z = await fetchProfileStats(mockClient(() => ({ data: { review_count: 0, nav_count: 0 }, error: null })), 'u');
  assert.deepEqual(z, { status: 'ready', reviews: 0, navs: 0 }, 'a real zero is still ready');
}
console.log('ok: ready state returns real counters (including real zeros)');

// ── missing row is its own state, never zero
{
  const r = await fetchProfileStats(mockClient(() => ({ data: null, error: null })), 'user-1');
  assert.equal(r.status, 'missing');
  assert.equal(r.message, PROFILE_STATS_MESSAGES.missing);
  assert.equal('reviews' in r, false);
  assert.equal(statTileValue(r, 'reviews'), '—');
  assert.equal(statTileValue(r, 'navs'), '—');
}
console.log('ok: missing profile row is "missing", not 0');

// ── database errors (unavailable db, missing table, RLS) are errors, never zero
{
  for (const error of [
    { message: 'TypeError: Failed to fetch' },
    { code: '42P01', message: 'relation "profiles" does not exist' },
    { code: '42501', message: 'permission denied for table profiles' },
  ]) {
    const r = await fetchProfileStats(mockClient(() => ({ data: null, error })), 'user-1');
    assert.equal(r.status, 'error');
    assert.equal(r.message, PROFILE_STATS_MESSAGES.error);
    assert.equal(statTileValue(r, 'reviews'), '—');
  }
  // client throwing instead of returning { error }
  const thrown = await fetchProfileStats(mockClient(() => { throw new Error('boom'); }), 'user-1');
  assert.equal(thrown.status, 'error');
}
console.log('ok: query errors / thrown errors are "error", not 0');

// ── malformed data is not coerced into a plausible-looking number
{
  for (const data of [
    { review_count: null, nav_count: 2 },
    { review_count: 2, nav_count: undefined },
    { review_count: '3', nav_count: 1 },
    { review_count: -1, nav_count: 1 },
    { review_count: 1.5, nav_count: 1 },
  ]) {
    const r = await fetchProfileStats(mockClient(() => ({ data, error: null })), 'user-1');
    assert.equal(r.status, 'error', JSON.stringify(data));
    assert.equal(r.message, PROFILE_STATS_MESSAGES.invalid);
  }
}
console.log('ok: null / non-integer / negative counters are rejected');

// ── hung request times out via the abort signal
{
  const c = mockClient((calls) => new Promise((_, reject) => {
    calls.signal.addEventListener('abort', () => {
      const e = new Error('aborted'); e.name = 'AbortError'; reject(e);
    });
  }));
  const r = await fetchProfileStats(c, 'user-1', { timeoutMs: 20 });
  assert.equal(r.status, 'error');
  assert.equal(r.message, PROFILE_STATS_MESSAGES.timeout);
  // abort surfaced as { error } rather than a throw
  const c2 = mockClient((calls) => new Promise((resolve) => {
    calls.signal.addEventListener('abort', () => resolve({ data: null, error: { name: 'AbortError', message: 'aborted' } }));
  }));
  const r2 = await fetchProfileStats(c2, 'user-1', { timeoutMs: 20 });
  assert.equal(r2.message, PROFILE_STATS_MESSAGES.timeout);
}
console.log('ok: hung request ends as a timeout error');

// ── no user id → never queries, never zero
{
  let queried = false;
  const c = { from() { queried = true; } };
  const r = await fetchProfileStats(c, undefined);
  assert.equal(r.status, 'error');
  assert.equal(queried, false);
}
console.log('ok: no user id is an error without querying');

// ── tile values
assert.equal(statTileValue({ status: 'loading' }, 'reviews'), '…');
assert.equal(statTileValue({ status: 'ready', reviews: 0, navs: 5 }, 'reviews'), 0);
assert.equal(statTileValue({ status: 'ready', reviews: 0, navs: 5 }, 'navs'), 5);
assert.equal(statTileValue({ status: 'error', message: 'x' }, 'navs'), '—');
console.log('ok: stat tile values per state');

// ── sign out: success resolves
{
  let called = 0;
  await signOutOrThrow({ signOut: async () => { called++; return { error: null }; } });
  assert.equal(called, 1);
}
// ── sign out: Supabase returns { error } -> rejects (previously ignored)
{
  const err = { message: 'Failed to fetch', status: 0 };
  await assert.rejects(() => signOutOrThrow({ signOut: async () => ({ error: err }) }), (e) => e === err);
}
// ── sign out: client throws -> rejects, non-Error wrapped
{
  await assert.rejects(() => signOutOrThrow({ signOut: async () => { throw new Error('network down'); } }), /network down/);
  await assert.rejects(() => signOutOrThrow({ signOut: async () => { throw 'str'; } }), (e) => e instanceof Error && e.message === 'str');
}
assert.match(SIGN_OUT_FAILED_MESSAGE, /couldn't sign you out/i, 'failure message must not claim success');
console.log('ok: sign-out surfaces Supabase errors instead of swallowing them');
