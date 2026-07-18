import L from 'leaflet';

/**
 * Ported from legacy's `initQuickChips` IIFE (app.js ~6333–6932) — the
 * colour map, emoji fallbacks, keyword→type map, and the `gatherResults`
 * scoring/sort logic. Pure data + pure functions live here; the
 * components (QuickChips.jsx, ChipResultsPanel.jsx) hold the DOM/state.
 */

export const TYPE_COLORS = {
  kiosk: '#F59E0B', shopping: '#F59E0B', bank: '#10B981',
  printing_shop: '#6366F1', cafe: '#F97316', restaurant: '#EF4444',
  pharmacy: '#EC4899', barber: '#0EA5E9', laundry: '#06B6D4', fuel: '#84CC16',
  library: '#9FE1CB', hostel: '#60A5FA', staff_quarters: '#60A5FA',
  mosque: '#A78BFA', chapel: '#A78BFA', bus_stop: '#34D399',
  clinic: '#F87171', sports: '#FBBF24', hall: '#FBBF24', auditorium: '#FBBF24',
  garage: '#94A3B8', utility: '#94A3B8', security_post: '#64748B', gate: '#E2E8F0',
  landmark: '#CBD5E1', entrance: '#CBD5E1', junction: '#CBD5E1', poi: '#CBD5E1',
  lecture_hall: '#378ADD', faculty: '#185FA5', laboratory: '#5DCAA5',
  workshop: '#1D9E75', admin: '#AFA9EC', senate: '#7F77DD',
  bursary: '#7F77DD', student_affairs: '#7F77DD',
};
export function dotColor(t) {
  return TYPE_COLORS[t] || '#DDB7FF';
}

export const TYPE_EMOJI = {
  kiosk: '🏪', shopping: '🛍️', bank: '🏧', library: '📚',
  printing_shop: '🖨️', cafe: '☕', restaurant: '🍽️',
  pharmacy: '💊', barber: '💈', laundry: '🧺', fuel: '⛽',
  hostel: '🏠', staff_quarters: '🏘️', mosque: '🕌', chapel: '⛪',
  bus_stop: '🚌', clinic: '🏥', sports: '⚽', hall: '🏛️',
  auditorium: '🎭', garage: '🔧', gate: '🚧', landmark: '📍',
  security_post: '🛡️',
  lecture_hall: '🎓', faculty: '🏫', laboratory: '🔬',
  workshop: '🛠️', admin: '🏢', senate: '⚖️', bursary: '💰',
};
export function typeEmoji(t, fallback) {
  return TYPE_EMOJI[t] || fallback || '📍';
}

export function fmtDist(m) {
  if (m < 50) return 'Very close';
  if (m < 1000) return Math.round(m) + 'm away';
  return (m / 1000).toFixed(1) + 'km away';
}

const KW_MAP = {
  kiosk: ['kiosk', 'shopping'], canteen: ['kiosk', 'restaurant'],
  food: ['kiosk', 'restaurant', 'cafe'], shop: ['kiosk', 'shopping'],
  store: ['kiosk', 'shopping'], market: ['kiosk', 'shopping'],
  pos: ['bank'], atm: ['bank'], bank: ['bank'],
  printing: ['printing_shop', 'kiosk'], print: ['printing_shop'],
  photocopy: ['printing_shop'], business: ['printing_shop'],
  centre: ['printing_shop', 'shopping'],
  cafe: ['cafe'], snack: ['cafe'], coffee: ['cafe'], tea: ['cafe'],
  restaurant: ['restaurant'], eatery: ['restaurant'],
  pharmacy: ['pharmacy'], chemist: ['pharmacy'], drug: ['pharmacy'], medicine: ['pharmacy'],
  barber: ['barber'], salon: ['barber'], hair: ['barber'], cut: ['barber'],
  laundry: ['laundry'], wash: ['laundry'], dry: ['laundry'], cleaning: ['laundry'],
  fuel: ['fuel'], petrol: ['fuel'], gas: ['fuel'], station: ['fuel'],
  garage: ['garage', 'utility'], parking: ['garage'], mechanic: ['garage'],
  security: ['security_post'], guard: ['security_post'], checkpoint: ['security_post'],
  library: ['library'],
  hostel: ['hostel', 'staff_quarters'], dorm: ['hostel'],
  hall: ['hostel', 'hall', 'auditorium', 'lecture_hall'],
  mosque: ['mosque'], chapel: ['chapel'], church: ['chapel'],
  worship: ['mosque', 'chapel'],
  bus: ['bus_stop'], stop: ['bus_stop'], transit: ['bus_stop'],
  transport: ['bus_stop'],
  clinic: ['clinic'], health: ['clinic'], medical: ['clinic'],
  hospital: ['clinic'],
  gate: ['gate', 'entrance', 'landmark'], entrance: ['gate', 'entrance'],
  sports: ['sports', 'hall', 'auditorium'], field: ['sports'],
  court: ['sports'], gym: ['sports'],
  lecture: ['lecture_hall'], lt: ['lecture_hall'],
  lab: ['laboratory'], laboratory: ['laboratory'],
  workshop: ['workshop'], faculty: ['faculty'],
  admin: ['admin', 'senate', 'bursary', 'student_affairs'],
  senate: ['senate'], bursary: ['bursary'], registry: ['admin'],
};

function queryToTypes(q) {
  const types = new Set();
  q.toLowerCase().split(/\s+/).forEach((w) => {
    const m = KW_MAP[w];
    if (m) m.forEach((t) => types.add(t));
  });
  return types;
}
function queryWords(q) {
  return q.toLowerCase().split(/\s+/).filter((w) => w.length >= 2);
}

// No GPS tracking exists yet (that's Slice 9's territory — the
// `navigator.geolocation.watchPosition` call that populates legacy's
// `window.lastKnownPos`). Always returning null here reproduces exactly
// how legacy itself behaves before GPS starts: results sort alphabetically
// instead of by distance. Revisit once Slice 9 exposes a live position.
function getUserLatLng() {
  return null;
}
function distanceTo(uLat, uLng, lat, lng) {
  return L.latLng(uLat, uLng).distanceTo(L.latLng(lat, lng));
}

/**
 * Ports `gatherResults` (app.js ~6471–6543). Deviation, flagged: legacy's
 * Pass 1 walks live Leaflet markers (`window._waypointLayers`) to reach
 * each marker's `_placeCardOpts.imageUrls`; this port's `waypoints` prop
 * already carries `imageUrls` per-item (Slice 2 attaches them when
 * building the array), so Pass 1 reads `waypoints` directly — same
 * result, no DOM reach-through needed. Pass 2 (catches KML-only points,
 * and — faithfully, rarely — segments) queries the shared `searchIndex`
 * exactly as legacy queries `FUTA_SEARCH`.
 */
/** Normalises a stored `type` value for comparison against `KW_MAP`'s
 * lowercase snake_case vocabulary. Chip matching is exact-string
 * (`types.has(t)`), so a single row saved as `"Kiosk"` or `"kiosk "` (easy
 * to end up with after manual entry or a Firebase->Supabase migration)
 * would silently never match any chip — this makes that class of mismatch
 * a non-issue without changing what actually counts as a match. */
function normType(t) {
  return (t || '').trim().toLowerCase();
}

export function gatherResults(query, { waypoints, searchIndex }) {
  const types = queryToTypes(query);
  const words = queryWords(query);
  const user = getUserLatLng();
  const seen = new Set();
  const out = [];

  (waypoints || []).forEach((wp) => {
    const t = normType(wp.type);
    if (!wp.lat || !wp.lng) return;
    const raw = (wp.name || '').trim();
    if (!raw) return;
    const nameLow = raw.toLowerCase();
    const typeMatch = types.has(t);
    const nameMatch = words.some((w) => nameLow.includes(w));
    if (!typeMatch && !nameMatch) return;
    if (seen.has(nameLow)) return;
    seen.add(nameLow);

    const dist = user ? distanceTo(user.lat, user.lng, wp.lat, wp.lng) : null;
    out.push({
      id: wp.id,
      name: raw,
      type: t,
      lat: wp.lat,
      lng: wp.lng,
      desc: wp.description || '',
      imageUrls: wp.imageUrls || [],
      dist,
    });
  });

  words.forEach((w) => {
    if (w.length < 2) return;
    searchIndex.query(w, 30).forEach((r) => {
      const t = normType(r.subtype || r.type) || 'poi';
      const typeMatch = types.has(t);
      const nameStrong = (r._score || 0) >= 40;
      if (!typeMatch && !nameStrong) return;
      const lat = parseFloat(r.lat);
      const lng = parseFloat(r.lng);
      if (!lat || !lng) return;
      const key = (r.name || '').toLowerCase().trim();
      if (!key || seen.has(key)) return;
      seen.add(key);

      const matchWp = (waypoints || []).find(
        (wp) => wp.lat != null && Math.abs(wp.lat - lat) < 0.00005 && Math.abs(wp.lng - lng) < 0.00005
      );
      const dist = user ? distanceTo(user.lat, user.lng, lat, lng) : null;
      out.push({
        id: r.id,
        name: r.name,
        type: t,
        lat,
        lng,
        desc: r.desc || '',
        imageUrls: matchWp?.imageUrls || [],
        dist,
      });
    });
  });

  out.sort((a, b) => {
    if (a.dist === null && b.dist === null) return a.name.localeCompare(b.name);
    if (a.dist === null) return 1;
    if (b.dist === null) return -1;
    return a.dist - b.dist;
  });

  return out;
}

/**
 * The 12 chip definitions (index.html ~1049–1060). `iconKey` maps into
 * lucide-react via `lib/legacyIconMap.js`. Mosque and Sports used to fall
 * back to legacy's own emoji (`data-icon-text`) here since neither had a
 * confirmed Lucide equivalent — resolved in Slice 7 with hand-drawn
 * custom SVGs (`lib/MosqueIcon.jsx`/`FootballIcon.jsx`), so all 12 chips
 * now render a real icon component.
 */
export const CHIPS = [
  { query: 'kiosk', label: 'Kiosk', iconKey: 'shop', emoji: '🛒' },
  { query: 'POS bank atm', label: 'POS / ATM', iconKey: 'bank2', emoji: '💳' },
  { query: 'printing print photocopy', label: 'Printing', iconKey: 'printer-fill', emoji: '🖨️' },
  { query: 'garage', label: 'Garage', iconKey: 'bus-front-fill', emoji: '🔧' },
  { query: 'library', label: 'Library', iconKey: 'building-fill', emoji: '📚' },
  { query: 'hostel', label: 'Hostel', iconKey: 'house-door-fill', emoji: '🏠' },
  { query: 'chapel church fellowship', label: 'Church', iconKey: 'church', emoji: '⛪' },
  { query: 'bus stop', label: 'Bus Stop', iconKey: 'bus-front-fill', emoji: '🚌' },
  { query: 'clinic', label: 'Clinic', iconKey: 'hospital-fill', emoji: '🏥' },
  { query: 'canteen food', label: 'Canteen', iconKey: 'restaurant-fill', emoji: '🍽️' },
  { query: 'mosque', label: 'Mosque', iconKey: 'mosque', emoji: '🕌' },
  { query: 'sports', label: 'Sports', iconKey: 'football', emoji: '⚽' },
];
