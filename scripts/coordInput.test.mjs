// Run: node scripts/coordInput.test.mjs
import assert from 'node:assert/strict';
import { parseLatLng, formatLatLng, lineLength } from '../src/features/admin/coordInput.js';

assert.deepEqual(parseLatLng('7.30123, 5.13456'), { lat: 7.30123, lng: 5.13456 });
assert.deepEqual(parseLatLng(' (7.3012,5.1345) '), { lat: 7.3012, lng: 5.1345 }, 'brackets and no space');
assert.deepEqual(parseLatLng('7.3012 5.1345'), { lat: 7.3012, lng: 5.1345 }, 'space only');
assert.deepEqual(parseLatLng('-33.9, 151.2'), { lat: -33.9, lng: 151.2 }, 'negative');
assert.equal(parseLatLng('7.3012'), null, 'one number');
assert.equal(parseLatLng('7.3, 5.1, 4'), null, 'three numbers');
assert.equal(parseLatLng('95, 5.1'), null, 'latitude out of range');
assert.equal(parseLatLng('7.3, 190'), null, 'longitude out of range');
assert.equal(parseLatLng(''), null);
console.log('ok: parseLatLng');

assert.equal(formatLatLng('7.3', 5.1), '7.300000, 5.100000');
assert.deepEqual(parseLatLng(formatLatLng(7.301234, 5.134567)), { lat: 7.301234, lng: 5.134567 }, 'round-trips');
console.log('ok: formatLatLng');

assert.equal(lineLength([{ lat: 7.3, lng: 5.13 }]), 0);
const m = lineLength([{ lat: 7.3, lng: 5.13 }, { lat: 7.301, lng: 5.13 }, { lat: 7.302, lng: 5.13 }]);
assert.ok(Math.abs(m - 222.4) < 1, `two 0.001° steps north ≈ 222 m, got ${m}`);
console.log('ok: lineLength');
