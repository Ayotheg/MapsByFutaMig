// Run: node scripts/routeSummary.test.mjs
import assert from 'node:assert/strict';
import { fmtRouteDistance } from '../src/features/navigation/routeSummary.js';

assert.equal(fmtRouteDistance(3), '10 m');
assert.equal(fmtRouteDistance(846), '850 m');
assert.equal(fmtRouteDistance(1234), '1.2 km');
console.log('ok: fmtRouteDistance');
