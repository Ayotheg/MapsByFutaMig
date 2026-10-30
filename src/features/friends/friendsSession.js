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

// No 0/O/1/I so a code read aloud can't be misheard.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function createCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}

const CODE_RE = /^[A-Z2-9]{4}-[A-Z2-9]{4}$/;

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
