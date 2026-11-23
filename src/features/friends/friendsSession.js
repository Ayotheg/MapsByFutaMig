import { haversine } from '../../lib/geoUtils.js';

// Meet me supports 2–8 people; a race supports 2–4.
export const CAPACITY = { meet: 8, race: 4 };
// Inside this distance of the finish counts as arrived.
export const RACE_FINISH_M = 25;
// Inside this distance of each other, a meetup is done.
export const MEET_ARRIVED_M = 30;
// Meet me is designed for short-distance campus meetups (~5 km).
export const MEET_MAX_DISTANCE_M = 5000;
// The invite stops working this long after it's made, if nobody started.
export const LOBBY_TTL_MS = 30 * 60 * 1000;
// A race nobody finishes ends after an hour.
export const RACE_LIMIT_MS = 60 * 60 * 1000;
// How often a position goes out. Ranking doesn't need every fix.
export const SEND_EVERY_MS = 4000;
// No update for this long reads as "Paused" (app closed / screen locked).
export const PAUSED_AFTER_MS = 60 * 1000;
export const COUNTDOWN_MS = 3000;
// A racer gone this long (left, phone died, no signal) is out of the race.
export const DROP_AFTER_MS = 2 * 60 * 1000;
// The race's host gone this long: the next player takes over refereeing.
export const HOST_GONE_MS = 30 * 1000;
// In the lobby nothing needs refereeing and the host is probably in another
// app sharing the code, so wait longer before taking over.
export const HOST_GONE_LOBBY_MS = 3 * 60 * 1000;

// Who referees next: the earliest player in `order` still connected.
// Every phone works it out the same way, so they agree without talking.
export function nextHost(order, presentIds, excludeId) {
  return (order || []).find((id) => id !== excludeId && presentIds.has(id)) || null;
}

// Every player has either finished or dropped out.
export function raceDone(roster, finishers, dropped) {
  if (!roster?.length) return false;
  const done = new Set([...(finishers || []).map((f) => f.id), ...(dropped || [])]);
  return roster.every((id) => done.has(id));
}

const FORBIDDEN_IDS = new Set(['__proto__', 'constructor', 'prototype', 'toString', 'valueOf', 'hasOwnProperty']);

function sanitizeParticipantId(input) {
  if (typeof input !== 'string') return null;
  const id = input.trim();
  if (!id || id.length > CHAT_ID_MAX_LENGTH || FORBIDDEN_IDS.has(id)) return null;
  return id;
}

// How many spots are currently taken in a lobby or active session.
// Dropped meet peers free their spot; dropped racers stay on the roster so they can still finish.
export function roomOccupancy(session, presentCount = 0) {
  if (!session) return 0;
  if (session.roster?.length) {
    if (session.mode === 'meet') {
      const dropped = new Set(session.dropped || []);
      return session.roster.filter((id) => !dropped.has(id)).length;
    }
    return session.roster.length;
  }
  return presentCount;
}

// Whether `userId` can join (or rejoin) a race or meetup that is already live/counting down.
export function canLateJoin(session, userId) {
  const id = sanitizeParticipantId(userId);
  if (!session || !id) return false;
  if (session.phase !== 'live' && session.phase !== 'countdown') return false;
  const cap = CAPACITY[session.mode];
  if (!cap) return false;
  const roster = session.roster || [];
  const dropped = session.dropped || [];
  if (roster.includes(id) && !(session.mode === 'meet' && dropped.includes(id))) return true;
  return roomOccupancy(session) < cap;
}

// Host-side admission for a late joiner (or returning participant).
export function admitLateJoiner(session, joinerId, joinerName) {
  const id = sanitizeParticipantId(joinerId);
  if (!id) return { accepted: false, reason: 'invalid' };
  if (!session || session.phase === 'ended') return { accepted: false, reason: 'closed' };
  if (session.phase !== 'live' && session.phase !== 'countdown') return { accepted: false, reason: 'not-live' };
  if (!canLateJoin(session, id)) return { accepted: false, reason: 'full' };
  const existing = session.roster || [];
  const alreadyActive = existing.includes(id) && !(session.dropped || []).includes(id);
  const cleanName = alreadyActive
    ? sanitizeUsername(session.names?.[id]) || sanitizeUsername(joinerName) || 'Friend'
    : sanitizeUsername(joinerName) || sanitizeUsername(session.names?.[id]) || 'Friend';
  const roster = existing.includes(id) ? [...existing] : [...existing, id];
  const names = { ...(session.names || {}), [id]: cleanName };
  const dropped = (session.dropped || []).filter((x) => x !== id);
  return { accepted: true, roster, names, dropped, name: cleanName };
}

// Meetup arrived: you and every active peer have a fix and either everyone
// is within MEET_ARRIVED_M of the chosen meeting point, or every pair in
// the group is within MEET_ARRIVED_M of each other (so all phones agree).
export function meetArrivedCheck(myFix, peerPositions, place) {
  if (!myFix || !peerPositions?.length) return false;
  if (peerPositions.some((p) => !p)) return false;
  const all = [myFix, ...peerPositions];
  if (place && all.every((p) => distanceM(p, place) <= MEET_ARRIVED_M)) return true;
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      if (distanceM(all[i], all[j]) > MEET_ARRIVED_M) return false;
    }
  }
  return true;
}

// No 0/O/1/I so a code read aloud can't be misheard.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// 6 characters (about a billion codes), read out as two halves: K7Q-29F.
export function createCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
  return `${chars.slice(0, 3)}-${chars.slice(3)}`;
}

const CODE_RE = /^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}$/;

// A typed code: any case, with or without the dash or spaces. Null until
// it's six valid characters.
export function normalizeCode(input) {
  const chars = String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const code = `${chars.slice(0, 3)}-${chars.slice(3)}`;
  return chars.length === 6 && CODE_RE.test(code) ? code : null;
}

// What the code box shows while typing: capitals, dash after three.
export function formatCodeInput(input) {
  const chars = String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  return chars.length > 3 ? `${chars.slice(0, 3)}-${chars.slice(3)}` : chars;
}

export function inviteUrl(mode, code) {
  return `${window.location.origin}/map?${mode}=${code}`;
}

// `?race=CODE` or `?meet=CODE` on /map.
export function parseInvite(search) {
  const params = new URLSearchParams(search);
  for (const mode of ['race', 'meet']) {
    const code = (params.get(mode) || '').toUpperCase();
    if (CODE_RE.test(code)) return { mode, code };
  }
  return null;
}

export function distanceM(a, b) {
  if (!a || !b) return null;
  return haversine(a.lat, a.lng, b.lat, b.lng);
}

export function formatDistance(m) {
  if (m == null || !Number.isFinite(m)) return '—';
  if (m < 1000) return `${Math.max(0, Math.round(m / 10) * 10)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function formatClock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function formatDuration(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  return m ? `${m}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`;
}

// ~80 m a minute walking.
export function walkMinutes(m) {
  if (m == null) return '—';
  if (m < 40) return 'Now';
  const mins = Math.max(1, Math.round(m / 80));
  if (mins < 60) return `~${mins} min`;
  const h = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `~${h}h ${rem}m` : `~${h}h`;
}

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function ago(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${Math.max(1, s)}s`;
  return `${Math.round(s / 60)} min`;
}

export function firstName(name) {
  return (name || 'Friend').trim().split(/\s+/)[0];
}

// Ephemeral in-session chat (Meet and Race). Nothing is persisted to the DB.
export const CHAT_MAX_LENGTH = 240;
export const CHAT_MAX_MESSAGES = 100;
export const CHAT_NAME_MAX_LENGTH = 60;
export const CHAT_ID_MAX_LENGTH = 96;
export const TYPING_TTL_MS = 3500;
export const TYPING_THROTTLE_MS = 2000;

export const CHAT_QUICK_REPLIES = {
  meet: ['On my way', 'I’m here', 'Wait 2 mins', 'Where are you?', 'I see you!'],
  race: ['On my way', 'Almost there!', 'Wait up!', 'Where are you?', 'Let’s go!'],
};

export function sanitizeChatText(input, maxLen = CHAT_MAX_LENGTH) {
  const text = String(input ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  const chars = Array.from(text);
  return chars.length > maxLen ? chars.slice(0, maxLen).join('') : text;
}

export function appendChatMessage(list, message) {
  if (!message?.id || !message.text) return list;
  if (list.some((m) => m.id === message.id)) return list;
  const next = [...list, message];
  return next.length > CHAT_MAX_MESSAGES ? next.slice(next.length - CHAT_MAX_MESSAGES) : next;
}

function isAllowedChatSender(senderId, session, presentIds) {
  if (session.mode === 'meet' && session.dropped?.includes(senderId)) return false;
  if (session.roster?.length) return session.roster.includes(senderId);
  return Boolean(presentIds?.has(senderId) || session.names?.[senderId]);
}

export function normalizeIncomingChat(payload, session, myId, presentIds, now = Date.now()) {
  if (!session?.joined || session.phase === 'ended' || !payload?.id || !payload?.senderId) return null;
  const senderId = String(payload.senderId).slice(0, CHAT_ID_MAX_LENGTH);
  if (!senderId || senderId === myId) return null;
  if (!isAllowedChatSender(senderId, session, presentIds)) return null;
  const id = String(payload.id).trim().slice(0, CHAT_ID_MAX_LENGTH);
  if (!id) return null;
  const text = sanitizeChatText(payload.text);
  if (!text) return null;
  const senderName =
    sanitizeChatText(session.names?.[senderId], CHAT_NAME_MAX_LENGTH) ||
    sanitizeChatText(payload.senderName, CHAT_NAME_MAX_LENGTH) ||
    'Friend';
  return { id, senderId, senderName, text, at: now };
}

export function normalizeIncomingTyping(payload, session, myId, presentIds, now = Date.now()) {
  if (!session?.joined || session.phase === 'ended' || !payload?.id) return null;
  const id = String(payload.id).slice(0, CHAT_ID_MAX_LENGTH);
  if (!id || id === myId) return null;
  if (!isAllowedChatSender(id, session, presentIds)) return null;
  const name =
    sanitizeChatText(session.names?.[id], CHAT_NAME_MAX_LENGTH) ||
    sanitizeChatText(payload.name, CHAT_NAME_MAX_LENGTH) ||
    'Friend';
  return { id, name, active: Boolean(payload.active), at: now };
}

export function normalizeIncomingPos(payload, session, presentIds, now = Date.now()) {
  if (!session?.joined || session.phase === 'ended' || !payload?.id) return null;
  const id = String(payload.id).slice(0, CHAT_ID_MAX_LENGTH);
  if (!id || !isAllowedChatSender(id, session, presentIds)) return null;
  if (session.mode === 'race') {
    if (!Number.isFinite(payload.dist) || payload.dist < 0) return null;
    return { id, dist: payload.dist, at: now };
  }
  if (
    !Number.isFinite(payload.lat) ||
    !Number.isFinite(payload.lng) ||
    payload.lat < -90 ||
    payload.lat > 90 ||
    payload.lng < -180 ||
    payload.lng > 180
  ) {
    return null;
  }
  return { id, lat: payload.lat, lng: payload.lng, at: now };
}

export function countUnreadMessages(messages, lastReadId, myId) {
  if (!messages?.length) return 0;
  const idx = lastReadId ? messages.findIndex((m) => m.id === lastReadId) : -1;
  const unseen = idx >= 0 ? messages.slice(idx + 1) : messages;
  return unseen.filter((m) => m.senderId !== myId).length;
}

export function formatMessageTime(ts) {
  if (!Number.isFinite(ts)) return '';
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export const USERNAME_MAX_LENGTH = 24;
export const SUGGESTED_USERNAMES = ['Campus Walker', 'FUTArian', 'Speedster', 'Obanla Guide'];

export function sanitizeUsername(input) {
  const text = String(input ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  const chars = Array.from(text);
  return chars.length > USERNAME_MAX_LENGTH ? chars.slice(0, USERNAME_MAX_LENGTH).join('') : text;
}

export function createGuestId() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `guest-${hex}`;
}

