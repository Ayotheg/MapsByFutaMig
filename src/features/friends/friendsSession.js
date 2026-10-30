import { haversine } from '../../lib/geoUtils.js';

// Meet me is two people (host + one friend); a race is 2–4.
export const CAPACITY = { meet: 2, race: 4 };
// Inside this distance of the finish counts as arrived.
export const RACE_FINISH_M = 25;
// Inside this distance of each other, a meetup is done.
export const MEET_ARRIVED_M = 30;
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
  return m < 40 ? 'Now' : `~${Math.max(1, Math.round(m / 80))} min`;
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
