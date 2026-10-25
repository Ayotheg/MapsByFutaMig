// Run: node scripts/routePlans.test.mjs
import assert from 'node:assert/strict';
import { createPlanCache, PLAN_MAX_AGE_MS, PLAN_RETRY_AFTER_FAIL_MS } from '../src/features/navigation/routePlans.js';

const dest = { lat: 7.3, lng: 5.14 };
const here = { lat: 7.29, lng: 5.13 };
const paths = [];

{
  let t = 0;
  let calls = 0;
  const cache = createPlanCache(() => {
    calls++;
    return new Promise(() => {}); // still in flight
  }, () => t);
  const a = cache.plan(dest, 'foot-walking', here, paths);
  for (let i = 0; i < 20; i++) cache.plan(dest, 'foot-walking', here, paths); // a GPS fix a second
  assert.equal(calls, 1, 'one request while in flight');
  assert.equal(cache.get(dest, 'foot-walking', here, paths), a, 'Start finds the in-flight plan');
  cache.plan(dest, 'cycling-regular', here, paths);
  assert.equal(calls, 2, 'another mode is another request');
  cache.plan(dest, 'foot-walking', { lat: 7.2903, lng: 5.13 }, paths); // ~33 m away
  assert.equal(calls, 3, 'moved past PLAN_MAX_MOVE_M');
  cache.plan(dest, 'foot-walking', here, []);
  assert.equal(calls, 4, 'new shortcut paths');
  t = PLAN_MAX_AGE_MS;
  assert.equal(cache.get(dest, 'foot-walking', here, paths), null, 'too old');
  console.log('ok: one request per plan');
}

{
  let t = 0;
  let calls = 0;
  const cache = createPlanCache(() => {
    calls++;
    return Promise.reject(new Error('offline'));
  }, () => t);
  cache.plan(dest, 'foot-walking', here, paths);
  await new Promise((r) => setTimeout(r, 0));
  for (let i = 0; i < 10; i++) cache.plan(dest, 'foot-walking', here, paths);
  assert.equal(calls, 1, 'no retry storm after a failure');
  assert.equal(cache.get(dest, 'foot-walking', here, paths).failed, true);
  t = PLAN_RETRY_AFTER_FAIL_MS;
  cache.plan(dest, 'foot-walking', here, paths);
  assert.equal(calls, 2, 'retries once the wait is over');
  console.log('ok: failures wait before retrying');
}
