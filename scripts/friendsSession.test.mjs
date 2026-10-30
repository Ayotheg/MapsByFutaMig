// Run: node scripts/friendsSession.test.mjs
import assert from 'node:assert/strict';
import {
  createCode,
  parseInvite,
  formatDistance,
  formatClock,
  formatDuration,
  ordinal,
  walkMinutes,
  distanceM,
} from '../src/features/friends/friendsSession.js';

for (let i = 0; i < 200; i++) {
  const code = createCode();
  assert.match(code, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/, `no 0/O/1/I: ${code}`);
}
console.log('ok: createCode');

assert.deepEqual(parseInvite('?race=K7Q2-9FXW'), { mode: 'race', code: 'K7Q2-9FXW' });
assert.deepEqual(parseInvite('?meet=p4m8-2lca'), { mode: 'meet', code: 'P4M8-2LCA' }, 'lower case from a retyped link');
assert.deepEqual(parseInvite('?utm=x&meet=P4M8-2LCA'), { mode: 'meet', code: 'P4M8-2LCA' }, 'other params');
assert.equal(parseInvite('?race=K7Q2'), null, 'too short');
assert.equal(parseInvite('?race=K7Q0-9FXW'), null, 'zero is never generated');
assert.equal(parseInvite('?race=<script>'), null);
assert.equal(parseInvite(''), null);
console.log('ok: parseInvite');

assert.equal(formatDistance(null), '—');
assert.equal(formatDistance(4), '0 m');
assert.equal(formatDistance(344), '340 m');
assert.equal(formatDistance(1234), '1.2 km');
assert.equal(formatClock(252000), '04:12');
assert.equal(formatDuration(402000), '6m 42s');
assert.equal(formatDuration(9000), '9s');
assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd']);
assert.equal(walkMinutes(20), 'Now');
assert.equal(walkMinutes(1200), '~15 min');
console.log('ok: formatting');

assert.equal(distanceM(null, { lat: 7.3, lng: 5.13 }), null);
const d = distanceM({ lat: 7.3, lng: 5.13 }, { lat: 7.301, lng: 5.13 });
assert.ok(Math.abs(d - 111.2) < 1, `0.001° north ≈ 111 m, got ${d}`);
console.log('ok: distanceM');
