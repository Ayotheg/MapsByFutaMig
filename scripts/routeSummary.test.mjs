// Run: node scripts/routeSummary.test.mjs
import assert from 'node:assert/strict';
import { fmtDuration, fmtRouteDistance, arrivalTime } from '../src/features/navigation/routeSummary.js';

assert.equal(fmtDuration(10), '1 min', 'never "0 min"');
assert.equal(fmtDuration(14.6 * 60), '15 min');
assert.equal(fmtDuration(60 * 60), '1 h');
assert.equal(fmtDuration(65 * 60), '1 h 5 min');
console.log('ok: fmtDuration');

assert.equal(fmtRouteDistance(3), '10 m');
assert.equal(fmtRouteDistance(846), '850 m');
assert.equal(fmtRouteDistance(1234), '1.2 km');
console.log('ok: fmtRouteDistance');

const now = new Date(2026, 9, 24, 22, 22).getTime();
assert.match(arrivalTime(15 * 60, now), /(10:37|22:37)/, 'now + 15 min');
console.log('ok: arrivalTime');
