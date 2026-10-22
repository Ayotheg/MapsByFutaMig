// Tests for src/features/navigation/mapSession.js's idle rule.
// Run: node scripts/mapSession.test.mjs (Node 18+).
import assert from 'node:assert/strict';
import { isIdleSince, MAP_IDLE_RESET_MS } from '../src/features/navigation/mapSession.js';

const now = 1_800_000_000_000;

assert.equal(isIdleSince(null, now), false, 'first visit is not a reset');
assert.equal(isIdleSince('123', now), false, 'garbage in storage is ignored');
assert.equal(isIdleSince(now - 60_000, now), false, 'a minute away restores');
assert.equal(isIdleSince(now - MAP_IDLE_RESET_MS, now), false, 'exactly at the limit still restores');
assert.equal(isIdleSince(now - MAP_IDLE_RESET_MS - 1, now), true, 'past the limit starts fresh');
console.log('ok: map state resets only after the idle limit');
