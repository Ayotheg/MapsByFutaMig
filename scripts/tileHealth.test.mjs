// Logic tests for src/features/map/tileHealth.js against a stub layer and
// fake timers. Run: node scripts/tileHealth.test.mjs (Node 20+).
// Not a browser test — see the note in tileHealth.js about what it can't see.
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import {
  watchTileLayer, TILE_STALL_MS, TILE_FAIL_THRESHOLD, TILE_GIVEUP_THRESHOLD, TILE_MAX_RETRIES,
} from '../src/features/map/tileHealth.js';

function stubLayer() {
  const h = {};
  return {
    on: (e, f) => ((h[e] ||= new Set()).add(f)),
    off: (e, f) => h[e]?.delete(f),
    once(e, f) { const w = (...a) => { this.off(e, w); f(...a); }; this.on(e, w); },
    fire: (e, p) => [...(h[e] || [])].forEach((f) => f(p)),
    count: (e) => h[e]?.size || 0,
  };
}
const mkTile = (src = 'https://t/1.png') => ({ src, isConnected: true, srcSets: [] });
const setup = (opts = {}) => {
  const layer = stubLayer(); const log = [];
  const dispose = watchTileLayer(layer, {
    onProblem: () => log.push('problem'), onRecovered: () => log.push('recovered'), ...opts,
  });
  return { layer, log, dispose };
};
mock.timers.enable({ apis: ['setTimeout'] });

// 1. nothing loads for 10s → problem
{ const { log } = setup();
  mock.timers.tick(TILE_STALL_MS - 1); assert.deepEqual(log, []);
  mock.timers.tick(1); assert.deepEqual(log, ['problem']);
  console.log('ok 1: stall with nothing loaded → alert at 10s'); }

// 2. a tile loads before 10s → never alerts
{ const { layer, log } = setup();
  layer.fire('tileload', {}); mock.timers.tick(TILE_STALL_MS * 3); assert.deepEqual(log, []);
  console.log('ok 2: slow-but-working map never alerts'); }

// 3. N errors with zero loaded → problem (once only)
{ const { layer, log } = setup();
  for (let i = 0; i < TILE_FAIL_THRESHOLD + 3; i++) layer.fire('tileerror', { tile: mkTile() });
  assert.deepEqual(log, ['problem']);
  console.log('ok 3: repeated errors with no successes → single alert'); }

// 4. slow start: alert at 10s, then a tile loads → withdrawn; can re-alert later
{ const { layer, log } = setup();
  mock.timers.tick(TILE_STALL_MS); assert.deepEqual(log, ['problem']);
  layer.fire('tileload', {}); assert.deepEqual(log, ['problem', 'recovered']);
  console.log('ok 4: alert withdraws itself when tiles start arriving'); }

// 5. retry: same src re-assigned with backoff, max TILE_MAX_RETRIES, then gives up
{ const { layer } = setup();
  const tile = mkTile(); let assigns = 0;
  let src = tile.src; Object.defineProperty(tile, 'src', { get: () => src, set: (v) => { assigns++; src = v; } });
  layer.fire('tileerror', { tile }); mock.timers.tick(799); assert.equal(assigns, 0);
  mock.timers.tick(1); assert.equal(assigns, 1, 'first retry at 0.8s');
  layer.fire('tileerror', { tile }); mock.timers.tick(1600); assert.equal(assigns, 2, 'second retry at 1.6s');
  layer.fire('tileerror', { tile }); mock.timers.tick(10000); assert.equal(assigns, 2, 'no third retry');
  assert.equal(TILE_MAX_RETRIES, 2);
  console.log('ok 5: retries with backoff, capped at', TILE_MAX_RETRIES); }

// 6. retry skipped if tile was removed from the DOM / src changed
{ const { layer } = setup();
  const tile = mkTile(); let assigns = 0; let src = tile.src;
  Object.defineProperty(tile, 'src', { get: () => src, set: (v) => { assigns++; src = v; } });
  layer.fire('tileerror', { tile }); tile.isConnected = false; mock.timers.tick(5000);
  assert.equal(assigns, 0);
  console.log('ok 6: no retry for a tile Leaflet already discarded'); }

// 7. patchy: some tiles load, but N tiles fail after all retries → alert, NOT auto-withdrawn
{ const { layer, log } = setup();
  layer.fire('tileload', {});
  for (let i = 0; i < TILE_GIVEUP_THRESHOLD; i++) {
    const t = mkTile(); t.__retries = TILE_MAX_RETRIES; layer.fire('tileerror', { tile: t });
  }
  assert.deepEqual(log, ['problem']);
  layer.fire('tileload', {}); assert.deepEqual(log, ['problem'], 'other tiles loading does not hide it');
  console.log('ok 7: grey holes after retries → alert stays'); }

// 8. offline → no alert (OfflineBanner covers it), and it can still fire once online
{ let online = false; const { layer, log } = setup({ isOnline: () => online });
  mock.timers.tick(TILE_STALL_MS); assert.deepEqual(log, []);
  online = true;
  for (let i = 0; i < TILE_FAIL_THRESHOLD; i++) layer.fire('tileerror', { tile: mkTile() });
  assert.deepEqual(log, ['problem']);
  console.log('ok 8: silent while offline, alerts once back online'); }

// 9. dispose / layer removal: listeners + timers gone, nothing fires afterwards
{ const { layer, log } = setup();
  layer.fire('remove');
  assert.equal(layer.count('tileload'), 0); assert.equal(layer.count('tileerror'), 0);
  mock.timers.tick(TILE_STALL_MS * 2); assert.deepEqual(log, []);
  console.log('ok 9: removing the layer cleans up'); }
