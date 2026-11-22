// Run: node scripts/friendsSession.test.mjs
import assert from 'node:assert/strict';
import {
  createCode,
  parseInvite,
  normalizeCode,
  formatCodeInput,
  formatDistance,
  formatClock,
  formatDuration,
  ordinal,
  walkMinutes,
  distanceM,
  nextHost,
  raceDone,
  CHAT_MAX_LENGTH,
  CHAT_MAX_MESSAGES,
  CHAT_QUICK_REPLIES,
  sanitizeChatText,
  appendChatMessage,
  formatMessageTime,
} from '../src/features/friends/friendsSession.js';

for (let i = 0; i < 200; i++) {
  const code = createCode();
  assert.match(code, /^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}$/, `no 0/O/1/I: ${code}`);
}
console.log('ok: createCode');

assert.deepEqual(parseInvite('?race=K7Q-29F'), { mode: 'race', code: 'K7Q-29F' });
assert.deepEqual(parseInvite('?meet=p4m-82l'), { mode: 'meet', code: 'P4M-82L' }, 'lower case from a retyped link');
assert.deepEqual(parseInvite('?utm=x&meet=P4M-82L'), { mode: 'meet', code: 'P4M-82L' }, 'other params');
assert.equal(parseInvite('?race=K7Q'), null, 'too short');
assert.equal(parseInvite('?race=K7Q-09F'), null, 'zero is never generated');
assert.equal(parseInvite('?race=<script>'), null);
assert.equal(parseInvite(''), null);
console.log('ok: parseInvite');

assert.equal(normalizeCode('k7q29f'), 'K7Q-29F', 'typed without dash, lower case');
assert.equal(normalizeCode(' K7Q - 29F '), 'K7Q-29F', 'spaces');
assert.equal(normalizeCode('K7Q-29'), null, 'too short');
assert.equal(normalizeCode('K7Q-O9F'), null, 'letter O is never generated');
assert.equal(formatCodeInput('k7q2'), 'K7Q-2');
assert.equal(formatCodeInput('k7q29fxx'), 'K7Q-29F', 'capped at six');
console.log('ok: normalizeCode');

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

const here = new Set(['a', 'b', 'c']);
assert.equal(nextHost(['a', 'b', 'c'], here, 'a'), 'b', 'next in join order');
assert.equal(nextHost(['a', 'x', 'c'], here, 'a'), 'c', 'skips someone not connected');
assert.equal(nextHost(['a'], here, 'a'), null, 'nobody left');
assert.equal(nextHost(null, here, 'a'), null);
console.log('ok: nextHost');

assert.equal(raceDone(['a', 'b'], [{ id: 'a', ms: 1 }], []), false);
assert.equal(raceDone(['a', 'b'], [{ id: 'a', ms: 1 }], ['b']), true, 'the rest dropped out');
assert.equal(raceDone(['a', 'b'], [], ['a', 'b']), true, 'everyone left');
assert.equal(raceDone(null, [], []), false, 'no roster yet');
console.log('ok: raceDone');

assert.equal(sanitizeChatText('   '), null, 'blank message ignored');
assert.equal(sanitizeChatText('  On   my\nway  '), 'On my way', 'whitespace normalized');
assert.equal(sanitizeChatText('a'.repeat(CHAT_MAX_LENGTH + 20)).length, CHAT_MAX_LENGTH, 'length capped');
assert.ok(CHAT_QUICK_REPLIES.meet.length >= 4 && CHAT_QUICK_REPLIES.race.length >= 4, 'quick replies defined for meet and race');

let thread = [];
thread = appendChatMessage(thread, { id: 'm1', text: 'Here' });
thread = appendChatMessage(thread, { id: 'm1', text: 'Here' });
assert.equal(thread.length, 1, 'deduplicates by id');
assert.equal(appendChatMessage(thread, { id: '', text: 'bad' }), thread, 'ignores missing id');
let capped = [];
for (let i = 0; i < CHAT_MAX_MESSAGES + 10; i++) {
  capped = appendChatMessage(capped, { id: `id-${i}`, text: `msg ${i}` });
}
assert.equal(capped.length, CHAT_MAX_MESSAGES, 'caps retained messages');
assert.equal(capped[0].id, 'id-10', 'drops oldest messages');
assert.match(formatMessageTime(Date.UTC(2026, 0, 1, 9, 5)), /^\d{2}:\d{2}$/, 'formats HH:MM');
assert.equal(formatMessageTime(NaN), '', 'invalid timestamp returns empty string');
console.log('ok: chat helpers');