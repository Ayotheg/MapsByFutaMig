/**
 * Explore → Events: the date/price helpers the Events tab, EventCard and
 * the /event preview share. Events come from public_events()
 * (supabase/events.sql), mapped by useEvents.js to:
 *
 *   { id, title, organiser, startsAt, endsAt (ISO), price (0 = free),
 *     priceNote, poster (url | null), about, isFeatured,
 *     venue: { name, hint, lat, lng } | null,
 *     online: { platform, link } | null }
 */

const DAY_MS = 24 * 60 * 60 * 1000;

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

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function filterEvents(events, filter, now = new Date()) {
  return events.filter((e) => {
    const start = new Date(e.startsAt);
    if (filter === 'today') return sameDay(start, now);
    if (filter === 'week') return start.getTime() - now.getTime() < 7 * DAY_MS;
    if (filter === 'free') return !e.price;
    if (filter === 'paid') return e.price > 0;
    return true;
  });
}

export function monthShort(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { month: 'short' }).toUpperCase();
}

export function dayOfMonth(iso) {
  return new Date(iso).getDate();
}

function timeOf(iso) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// "Fri · 10:00 AM"
export function shortWhen(iso) {
  return `${new Date(iso).toLocaleDateString('en-GB', { weekday: 'short' })} · ${timeOf(iso)}`;
}

// "Friday, 24 October"
export function longDate(iso) {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-GB', { weekday: 'long' })}, ${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'long' })}`;
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
