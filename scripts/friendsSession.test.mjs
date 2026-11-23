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
  CAPACITY,
  roomOccupancy,
  canLateJoin,
  admitLateJoiner,
  meetArrivedCheck,
  CHAT_MAX_LENGTH,
  CHAT_MAX_MESSAGES,
  CHAT_NAME_MAX_LENGTH,
  CHAT_QUICK_REPLIES,
  MEET_MAX_DISTANCE_M,
  SUGGESTED_USERNAMES,
  USERNAME_MAX_LENGTH,
  createGuestId,
  sanitizeChatText,
  sanitizeUsername,
  appendChatMessage,
  normalizeIncomingChat,
  normalizeIncomingPos,
  normalizeIncomingTyping,
  countUnreadMessages,
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
assert.equal(sanitizeChatText(null), null, 'null ignored');
assert.equal(sanitizeChatText(undefined), null, 'undefined ignored');
assert.equal(sanitizeChatText('\r\n\t '), null, 'control whitespace ignored');
assert.equal(sanitizeChatText('  On   my\nway  '), 'On my way', 'whitespace normalized');
assert.equal(Array.from(sanitizeChatText('a'.repeat(CHAT_MAX_LENGTH + 20))).length, CHAT_MAX_LENGTH, 'length capped');
const emojiAtCap = sanitizeChatText(`${'a'.repeat(CHAT_MAX_LENGTH - 1)}👋extra`);
assert.ok(emojiAtCap.endsWith('👋'), 'does not split surrogate-pair emoji at cap');
assert.ok(CHAT_QUICK_REPLIES.meet.length >= 4 && CHAT_QUICK_REPLIES.race.length >= 4, 'quick replies defined for meet and race');

const baseThread = [];
const t1 = appendChatMessage(baseThread, { id: 'm1', text: 'Here' });
assert.equal(baseThread.length, 0, 'does not mutate input array');
const t2 = appendChatMessage(t1, { id: 'm1', text: 'Here' });
assert.equal(t2.length, 1, 'deduplicates by id');
assert.equal(appendChatMessage(t2, null), t2, 'ignores null message');
assert.equal(appendChatMessage(t2, { id: '', text: 'bad' }), t2, 'ignores missing id');
assert.equal(appendChatMessage(t2, { id: 'm2', text: '' }), t2, 'ignores empty text');
let capped = [];
for (let i = 0; i < CHAT_MAX_MESSAGES + 10; i++) {
  capped = appendChatMessage(capped, { id: `id-${i}`, text: `msg ${i}` });
}
assert.equal(capped.length, CHAT_MAX_MESSAGES, 'caps retained messages');
assert.equal(capped[0].id, 'id-10', 'drops oldest messages');

const liveSession = { joined: true, phase: 'live', roster: ['u1', 'u2'], names: { u1: 'Ayo', u2: 'Tolu' } };
assert.equal(
  normalizeIncomingChat({ id: 'c1', senderId: 'u1', text: 'spoofed' }, liveSession, 'u1', new Set(['u1', 'u2']), 1000),
  null,
  'rejects self-spoofed senderId'
);
assert.equal(
  normalizeIncomingChat({ id: 'c2', senderId: 'intruder', text: 'hi' }, liveSession, 'u1', new Set(['u1', 'u2', 'intruder']), 1000),
  null,
  'rejects non-roster sender in live session'
);
assert.deepEqual(
  normalizeIncomingChat({ id: 'c3', senderId: 'u2', senderName: 'Fake Name', text: '  Here! ', at: 9999999999999 }, liveSession, 'u1', new Set(['u1', 'u2']), 5000),
  { id: 'c3', senderId: 'u2', senderName: 'Tolu', text: 'Here!', at: 5000 },
  'prefers verified session name and stamps receipt time'
);
const lobbySession = { joined: true, phase: 'lobby', roster: null, names: { u1: 'Ayo' } };
const lobbyMsg = normalizeIncomingChat(
  { id: 'c4', senderId: 'u2', senderName: 'X'.repeat(CHAT_NAME_MAX_LENGTH + 15), text: 'Ready' },
  lobbySession,
  'u1',
  new Set(['u1', 'u2']),
  6000
);
assert.equal(lobbyMsg.senderName.length, CHAT_NAME_MAX_LENGTH, 'clamps fallback sender name');
assert.equal(
  normalizeIncomingChat({ id: 'c5', senderId: 'u3', text: 'hi' }, lobbySession, 'u1', new Set(['u1', 'u2']), 6000),
  null,
  'rejects unknown sender in lobby'
);
assert.equal(normalizeIncomingTyping({ id: 'u1', active: true }, liveSession, 'u1', new Set(['u1', 'u2']), 7000), null, 'rejects self typing');
assert.equal(normalizeIncomingTyping({ id: 'intruder', active: true }, liveSession, 'u1', new Set(['u1', 'u2']), 7000), null, 'rejects non-roster typing');
assert.deepEqual(
  normalizeIncomingTyping({ id: 'u2', active: true }, liveSession, 'u1', new Set(['u1', 'u2']), 7000),
  { id: 'u2', name: 'Tolu', active: true, at: 7000 },
  'accepts valid typing event'
);

const sample = [
  { id: '1', senderId: 'u2', text: 'Hey' },
  { id: '2', senderId: 'u1', text: 'On my way' },
  { id: '3', senderId: 'u2', text: 'At Senate' },
  { id: '4', senderId: 'u3', text: 'Almost there' },
];
assert.equal(countUnreadMessages(sample, null, 'u1'), 3, 'counts all peer messages when never read');
assert.equal(countUnreadMessages(sample, '1', 'u1'), 2, 'excludes own messages after lastReadId');
assert.equal(countUnreadMessages(sample, '4', 'u1'), 0, 'zero when caught up');
assert.equal(countUnreadMessages(sample, 'evicted-id', 'u1'), 3, 'falls back to all peer messages if lastReadId evicted');

assert.match(formatMessageTime(Date.UTC(2026, 0, 1, 9, 5)), /^\d{2}:\d{2}$/, 'formats HH:MM');
assert.equal(formatMessageTime(NaN), '', 'invalid timestamp returns empty string');
console.log('ok: chat helpers');

assert.equal(MEET_MAX_DISTANCE_M, 5000, 'Meet short-distance threshold is 5 km');
assert.equal(walkMinutes(null), '—');
assert.equal(walkMinutes(0), 'Now');
assert.equal(walkMinutes(4800), '~1h', 'exact hour formatting');
assert.equal(walkMinutes(6000), '~1h 15m', 'hour + minute formatting');
assert.equal(sanitizeUsername('   '), null, 'blank username rejected');
assert.equal(sanitizeUsername(null), null, 'null username rejected');
assert.equal(sanitizeUsername(undefined), null, 'undefined username rejected');
assert.equal(sanitizeUsername('\r\n\t '), null, 'control whitespace rejected');
assert.equal(sanitizeUsername('  Tolu   A. '), 'Tolu A.', 'username whitespace normalized');
assert.equal(Array.from(sanitizeUsername('a'.repeat(USERNAME_MAX_LENGTH + 10))).length, USERNAME_MAX_LENGTH, 'username length capped');
const emojiName = sanitizeUsername(`${'a'.repeat(USERNAME_MAX_LENGTH - 1)}👋extra`);
assert.ok(emojiName.endsWith('👋'), 'username does not split surrogate-pair emoji');
for (const preset of SUGGESTED_USERNAMES) {
  assert.equal(sanitizeUsername(preset), preset, `preset valid: ${preset}`);
}
assert.match(createGuestId(), /^guest-[0-9a-f]{16}$/, 'guest id format');
assert.notEqual(createGuestId(), createGuestId(), 'guest ids are unique');

const guestSession = { joined: true, phase: 'live', mode: 'meet', roster: ['guest-1', 'guest-2'], names: { 'guest-1': 'Ayo', 'guest-2': 'Tolu' } };
assert.deepEqual(
  normalizeIncomingChat({ id: 'g1', senderId: 'guest-2', text: 'Here' }, guestSession, 'guest-1', new Set(['guest-1', 'guest-2']), 1000),
  { id: 'g1', senderId: 'guest-2', senderName: 'Tolu', text: 'Here', at: 1000 },
  'guest chat accepted'
);
assert.equal(
  normalizeIncomingChat({ id: 'g2', senderId: 'guest-2', text: 'Late' }, { ...guestSession, phase: 'ended' }, 'guest-1', new Set(['guest-1', 'guest-2']), 1000),
  null,
  'rejects chat after session ended'
);
assert.equal(
  normalizeIncomingChat({ id: 'g3', senderId: 'guest-2', text: 'Unjoined' }, { ...guestSession, joined: false }, 'guest-1', new Set(['guest-1', 'guest-2']), 1000),
  null,
  'rejects chat when not joined'
);

assert.deepEqual(
  normalizeIncomingPos({ id: 'guest-2', lat: 7.3, lng: 5.13, extra: 'ignored' }, guestSession, new Set(['guest-1', 'guest-2']), 2000),
  { id: 'guest-2', lat: 7.3, lng: 5.13, at: 2000 },
  'valid meet position accepted and stripped of extra fields'
);
assert.equal(normalizeIncomingPos({ id: 'guest-2', lat: NaN, lng: 5.13 }, guestSession, new Set(['guest-1', 'guest-2']), 2000), null, 'rejects NaN lat');
assert.equal(normalizeIncomingPos({ id: 'guest-2', lat: 95, lng: 5.13 }, guestSession, new Set(['guest-1', 'guest-2']), 2000), null, 'rejects out-of-range lat');
assert.equal(normalizeIncomingPos({ id: 'intruder', lat: 7.3, lng: 5.13 }, guestSession, new Set(['guest-1', 'guest-2']), 2000), null, 'rejects non-roster pos');
const raceSession = { joined: true, phase: 'live', mode: 'race', roster: ['u1', 'u2'], names: { u1: 'Ayo', u2: 'Tolu' } };
assert.deepEqual(
  normalizeIncomingPos({ id: 'u2', dist: 140 }, raceSession, new Set(['u1', 'u2']), 3000),
  { id: 'u2', dist: 140, at: 3000 },
  'valid race distance accepted'
);
assert.equal(normalizeIncomingPos({ id: 'u2', dist: -5 }, raceSession, new Set(['u1', 'u2']), 3000), null, 'rejects negative race distance');
console.log('ok: guest username & pos validation');

assert.ok(CAPACITY.meet >= 3, 'Meet supports 2 or more people');
const spot = { lat: 7.3000, lng: 5.1300 };
const north22 = { lat: 7.3002, lng: 5.1300 }; // ~22 m north of spot
const south22 = { lat: 7.2998, lng: 5.1300 }; // ~22 m south of spot (~44 m from north22)
const near1 = { lat: 7.3001, lng: 5.1300 };   // ~11 m
const near2 = { lat: 7.3000, lng: 5.1301 };   // ~11 m
const far = { lat: 7.3050, lng: 5.1300 };     // ~555 m
assert.equal(meetArrivedCheck(null, [near1, near2], null), false, 'null myFix is not arrived');
assert.equal(meetArrivedCheck(spot, [near1, near2], null), true, 'group arrived when all pairs within 30 m');
assert.equal(meetArrivedCheck(spot, [north22, south22], null), false, 'pairwise check rejects peers >30 m apart from each other');
assert.equal(meetArrivedCheck(spot, [north22, south22], spot), true, 'meeting-point branch passes when all are within 30 m of place');
assert.equal(meetArrivedCheck(spot, [near1, far], null), false, 'group not arrived if one peer is still far');
assert.equal(meetArrivedCheck(spot, [near1, null], null), false, 'group not arrived if a peer has no fix');
assert.equal(meetArrivedCheck(spot, [], null), false, 'empty peers is not arrived');

const droppedMeetSession = { ...guestSession, dropped: ['guest-2'] };
assert.equal(normalizeIncomingChat({ id: 'd1', senderId: 'guest-2', text: 'Hi' }, droppedMeetSession, 'guest-1', new Set(['guest-1']), 1000), null, 'rejects chat from dropped meet peer');
assert.equal(normalizeIncomingPos({ id: 'guest-2', lat: 7.3, lng: 5.13 }, droppedMeetSession, new Set(['guest-1']), 1000), null, 'rejects pos from dropped meet peer');
assert.equal(normalizeIncomingTyping({ id: 'guest-2', active: true }, droppedMeetSession, 'guest-1', new Set(['guest-1']), 1000), null, 'rejects typing from dropped meet peer');
console.log('ok: group meetup');

assert.equal(roomOccupancy({ mode: 'meet', phase: 'lobby', roster: null }, 3), 3, 'lobby uses presentCount');
assert.equal(roomOccupancy({ mode: 'race', phase: 'live', roster: ['u1', 'u2'], dropped: ['u2'] }), 2, 'race counts full roster incl. dropped');
assert.equal(roomOccupancy({ mode: 'meet', phase: 'live', roster: ['u1', 'u2', 'u3'], dropped: ['u2'] }), 2, 'meet counts active non-dropped only');

const liveRace2 = { mode: 'race', phase: 'live', roster: ['u1', 'u2'], names: { u1: 'Ayo', u2: 'Tolu' }, dropped: [] };
assert.equal(canLateJoin(liveRace2, 'u3'), true, 'live race under capacity accepts newcomer');
assert.equal(canLateJoin({ ...liveRace2, phase: 'countdown' }, 'u3'), true, 'countdown race accepts newcomer');
assert.equal(canLateJoin({ ...liveRace2, phase: 'lobby' }, 'u3'), false, 'lobby uses normal join, not late join');
assert.equal(canLateJoin({ ...liveRace2, phase: 'ended' }, 'u3'), false, 'ended race rejects late join');

const fullRace = { mode: 'race', phase: 'live', roster: ['u1', 'u2', 'u3', 'u4'], dropped: ['u4'] };
assert.equal(canLateJoin(fullRace, 'u5'), false, 'full race rejects newcomer even if a racer dropped');
assert.equal(canLateJoin(fullRace, 'u4'), true, 'dropped racer can rejoin full race');

const fullMeetWithDrop = { mode: 'meet', phase: 'live', roster: ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8'], dropped: ['m8'] };
assert.equal(canLateJoin(fullMeetWithDrop, 'm9'), true, 'dropped meet peer frees a slot for newcomer');
assert.equal(canLateJoin({ ...fullMeetWithDrop, dropped: [] }, 'm9'), false, 'full meet with no drops rejects newcomer');

const admittedRace = admitLateJoiner(liveRace2, 'u3', '  Chidi  ');
assert.deepEqual(admittedRace, {
  accepted: true,
  roster: ['u1', 'u2', 'u3'],
  names: { u1: 'Ayo', u2: 'Tolu', u3: 'Chidi' },
  dropped: [],
  name: 'Chidi',
});
assert.deepEqual(admitLateJoiner(fullRace, 'u5', 'Late'), { accepted: false, reason: 'full' });
assert.deepEqual(admitLateJoiner({ ...liveRace2, phase: 'ended' }, 'u3', 'Late'), { accepted: false, reason: 'closed' });
assert.deepEqual(admitLateJoiner({ ...liveRace2, phase: 'lobby' }, 'u3', 'Late'), { accepted: false, reason: 'not-live' });

const rejoinedMeet = admitLateJoiner(
  { mode: 'meet', phase: 'live', roster: ['m1', 'm2', 'm3'], names: { m1: 'Ayo', m2: 'Tolu', m3: 'Dami' }, dropped: ['m2'] },
  'm2',
  'Tolu B'
);
assert.equal(rejoinedMeet.accepted, true);
assert.deepEqual(rejoinedMeet.roster, ['m1', 'm2', 'm3'], 'rejoin does not duplicate roster entry');
assert.deepEqual(rejoinedMeet.dropped, [], 'rejoin clears dropped state');
assert.equal(rejoinedMeet.names.m2, 'Tolu B');

const updatedRaceSession = {
  ...liveRace2,
  joined: true,
  roster: admittedRace.roster,
  names: admittedRace.names,
  dropped: admittedRace.dropped,
};
assert.deepEqual(
  normalizeIncomingChat({ id: 'late-c1', senderId: 'u3', text: 'Coming!' }, updatedRaceSession, 'u1', new Set(['u1', 'u2', 'u3']), 9000),
  { id: 'late-c1', senderId: 'u3', senderName: 'Chidi', text: 'Coming!', at: 9000 }
);
assert.deepEqual(
  normalizeIncomingPos({ id: 'u3', dist: 320 }, updatedRaceSession, new Set(['u1', 'u2', 'u3']), 9100),
  { id: 'u3', dist: 320, at: 9100 }
);
assert.deepEqual(
  normalizeIncomingTyping({ id: 'u3', active: true }, updatedRaceSession, 'u1', new Set(['u1', 'u2', 'u3']), 9200),
  { id: 'u3', name: 'Chidi', active: true, at: 9200 }
);

// Dropped Meet peer cannot reclaim a spot taken by an 8th newcomer
const meet8Full = {
  mode: 'meet',
  phase: 'live',
  roster: ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9'],
  names: { m1: 'A', m2: 'B', m3: 'C', m4: 'D', m5: 'E', m6: 'F', m7: 'G', m8: 'H', m9: 'I' },
  dropped: ['m8'],
};
assert.equal(roomOccupancy(meet8Full), 8, '8 active peers after m9 replaced dropped m8');
assert.equal(canLateJoin(meet8Full, 'm8'), false, 'dropped meet peer cannot rejoin once 8th slot was filled');
assert.deepEqual(admitLateJoiner(meet8Full, 'm8', 'H'), { accepted: false, reason: 'full' });

// Dropped racer CAN rejoin a full 4/4 race without duplicating roster entry
const fullRaceWithDrop = {
  mode: 'race',
  phase: 'live',
  roster: ['u1', 'u2', 'u3', 'u4'],
  names: { u1: 'Ayo', u2: 'Tolu', u3: 'Chidi', u4: 'Dami' },
  dropped: ['u4'],
};
const rejoinedRace = admitLateJoiner(fullRaceWithDrop, 'u4', 'Dami');
assert.equal(rejoinedRace.accepted, true);
assert.deepEqual(rejoinedRace.roster, ['u1', 'u2', 'u3', 'u4']);
assert.deepEqual(rejoinedRace.dropped, []);

// Invalid / prototype-polluting IDs & active name-spoof protection
for (const badId of [null, undefined, 123, '', '   ', 'a'.repeat(100), '__proto__', 'constructor', 'prototype']) {
  assert.equal(canLateJoin(liveRace2, badId), false, `canLateJoin rejects bad id: ${String(badId)}`);
  assert.deepEqual(admitLateJoiner(liveRace2, badId, 'Evil'), { accepted: false, reason: 'invalid' }, `admitLateJoiner rejects bad id: ${String(badId)}`);
}
assert.equal(canLateJoin({ mode: 'unknown', phase: 'live', roster: ['u1'] }, 'u2'), false, 'unknown mode rejected');
assert.equal(admitLateJoiner(liveRace2, 'u3', '   ').name, 'Friend', 'blank name falls back to Friend');
assert.equal(
  admitLateJoiner(liveRace2, 'u1', 'Spoofed Host').names.u1,
  'Ayo',
  'active participant name cannot be overwritten via join-live'
);

// Interaction checks: raceDone, meetArrivedCheck, and 2-person Meet occupancy recovery
assert.equal(raceDone(['u1', 'u2'], [{ id: 'u1', ms: 1000 }], []), false, 'race not done yet');
assert.equal(raceDone(admittedRace.roster, [{ id: 'u1', ms: 1000 }, { id: 'u2', ms: 1200 }], []), false, 'late joiner keeps race open until they finish or drop');
assert.equal(meetArrivedCheck(spot, [near1], null), true, '2-person meet arrived when within 30 m');
assert.equal(meetArrivedCheck(spot, [near1, null], null), false, 'adding a late joiner without fix un-marks meet arrived');
assert.equal(meetArrivedCheck(spot, [near1, far], null), false, 'adding a far late joiner un-marks meet arrived');
assert.equal(roomOccupancy({ mode: 'meet', phase: 'live', roster: ['m1', 'm2', 'm3'], dropped: ['m3'] }), 2, 'meet drops back to 2-person occupancy when 3rd leaves');
console.log('ok: late join');