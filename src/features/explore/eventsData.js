/**
 * Explore → Events: the date/price helpers the Events tab, EventCard and
 * the /event preview share. Events come from public_events()
 * (supabase/events.sql), mapped by useEvents.js to:
 *
 *   { id, title, organiser, startsAt, endsAt (ISO), price (0 = free),
 *     priceNote, poster (url | null), about, isFeatured,
 *     venue: { name, hint, lat, lng } | null,
 *     online: { platform, link } | null }
 *
 * All event dates are FUTA (Lagos) time, whatever the device's time zone:
 * that's the time an organiser means, and what public_events() uses to
 * decide when an event drops off. Lagos is UTC+1 all year (no DST).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
export const EVENT_TZ = 'Africa/Lagos';
const LAGOS_OFFSET = '+01:00';

// Flat fee to list a ticketed or paid event; free events list at ₦0.
export const EVENT_LISTING_FEE = 3000;

// Featured rail rotation — same pace and slot count as the Places rail
// (ExplorePanel.jsx's ROTATE_MS / COMPACT_SLOTS).
export const FEATURED_ROTATE_MS = 7000;
export const FEATURED_SLOTS = 2;

export const EVENT_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'free', label: 'Free' },
  { key: 'paid', label: 'Paid' },
];

/** 'YYYY-MM-DD' of an instant, in Lagos. */
export function lagosDayKey(date) {
  return new Date(date).toLocaleDateString('en-CA', { timeZone: EVENT_TZ });
}

/** The instant a Lagos day + 'HH:MM' time happens. */
export function lagosInstant(day, time) {
  const d = new Date(`${day}T${time}:00${LAGOS_OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Last moment of the Lagos day an event starts on (when it leaves Explore). */
export function lagosEndOfDay(iso) {
  return new Date(`${lagosDayKey(iso)}T23:59:59.999${LAGOS_OFFSET}`);
}

export function filterEvents(events, filter, now = new Date()) {
  const today = lagosDayKey(now);
  return events.filter((e) => {
    const start = new Date(e.startsAt);
    if (filter === 'today') return lagosDayKey(start) === today;
    if (filter === 'week') return start.getTime() - now.getTime() < 7 * DAY_MS;
    if (filter === 'free') return !e.price;
    if (filter === 'paid') return e.price > 0;
    return true;
  });
}

function fmt(iso, options) {
  return new Date(iso).toLocaleString('en-GB', { timeZone: EVENT_TZ, ...options });
}

export function monthShort(iso) {
  return fmt(iso, { month: 'short' }).toUpperCase();
}

export function dayOfMonth(iso) {
  return Number(fmt(iso, { day: 'numeric' }));
}

function timeOf(iso) {
  return new Date(iso).toLocaleTimeString('en-US', { timeZone: EVENT_TZ, hour: 'numeric', minute: '2-digit' });
}

// "Fri · 10:00 AM"
export function shortWhen(iso) {
  return `${fmt(iso, { weekday: 'short' })} · ${timeOf(iso)}`;
}

// "Friday, 24 October"
export function longDate(iso) {
  return `${fmt(iso, { weekday: 'long' })}, ${dayOfMonth(iso)} ${fmt(iso, { month: 'long' })}`;
}

// "Sat, 25 Oct"
export function shortDate(iso) {
  return fmt(iso, { weekday: 'short', day: 'numeric', month: 'short' });
}

// "10:00 AM – 2:00 PM"
export function timeRange(e) {
  return e.endsAt ? `${timeOf(e.startsAt)} – ${timeOf(e.endsAt)}` : timeOf(e.startsAt);
}

export function priceLabel(e) {
  return e.price ? `₦${Number(e.price).toLocaleString('en-NG')}` : 'Free';
}

// "Obafemi Awolowo Auditorium" or "Online · Google Meet"
export function placeLabel(e) {
  if (e.online) return e.online.platform ? `Online · ${e.online.platform}` : 'Online';
  return e.venue?.name || '';
}

/** Only plain web links are ever opened or written into calendar files. */
export function isWebLink(url) {
  return typeof url === 'string' && /^https?:\/\/\S+$/i.test(url.trim());
}
