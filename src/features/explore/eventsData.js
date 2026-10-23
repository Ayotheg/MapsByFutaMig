/**
 * Explore → Events: placeholder events and the date/price helpers the
 * Events tab and EventCard share. The sample list stands in until events
 * come from Supabase; its shape is what the real rows should map to:
 *
 *   { id, title, organiser, startsAt, endsAt (ISO), price (0 = free),
 *     priceNote, poster (url | null), about, isFeatured,
 *     venue: { name, hint, lat, lng } | null,
 *     online: { platform, link } | null }
 */

const DAY_MS = 24 * 60 * 60 * 1000;

// Relative to today so the Today / This week chips always have something.
function at(daysFromNow, hour, minute = 0) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return new Date(d.getTime() + daysFromNow * DAY_MS).toISOString();
}

export const SAMPLE_EVENTS = [
  {
    id: 'sample-tech-week',
    title: 'Tech Week Kick-off',
    organiser: '[Organiser name]',
    startsAt: at(0, 10),
    endsAt: at(0, 14),
    price: 0,
    priceNote: 'No ticket needed',
    poster: null,
    about: "[Short description of the event: what happens, who it's for, anything to bring.]",
    isFeatured: true,
    venue: { name: 'Obafemi Awolowo Auditorium', hint: 'Near the Senate Building', lat: null, lng: null },
    online: null,
  },
  {
    id: 'sample-freshers',
    title: "Freshers' Hangout",
    organiser: '[Organiser name]',
    startsAt: at(2, 16),
    endsAt: at(2, 19),
    price: 1000,
    priceNote: 'Pay at the gate',
    poster: null,
    about: "[Short description of the event: what happens, who it's for, anything to bring.]",
    isFeatured: true,
    venue: { name: 'Sports Complex', hint: '[Venue hint]', lat: null, lng: null },
    online: null,
  },
  {
    id: 'sample-debate',
    title: 'Inter-faculty Debate',
    organiser: '[Organiser name]',
    startsAt: at(5, 14),
    endsAt: at(5, 17),
    price: 0,
    priceNote: 'No ticket needed',
    poster: null,
    about: "[Short description of the event: what happens, who it's for, anything to bring.]",
    isFeatured: true,
    venue: { name: '[Venue name]', hint: '', lat: null, lng: null },
    online: null,
  },
  {
    id: 'sample-cv-clinic',
    title: 'CV & LinkedIn Clinic',
    organiser: '[Organiser name]',
    startsAt: at(4, 19),
    endsAt: at(4, 20, 30),
    price: 0,
    priceNote: 'No ticket needed',
    poster: null,
    about: "[Short description of the event: what happens, who it's for, anything to bring.]",
    isFeatured: false,
    venue: null,
    online: { platform: 'Google Meet', link: null },
  },
  {
    id: 'sample-dinner',
    title: 'Departmental Dinner',
    organiser: '[Organiser name]',
    startsAt: at(8, 18),
    endsAt: at(8, 22),
    price: 5000,
    priceNote: 'Buy from your class rep',
    poster: null,
    about: "[Short description of the event: what happens, who it's for, anything to bring.]",
    isFeatured: false,
    venue: { name: '[Venue name]', hint: '', lat: null, lng: null },
    online: null,
  },
];

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
