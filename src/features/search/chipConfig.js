import L from 'leaflet';
import {
  CHIP_DISPLAY_ORDER,
  CATEGORY_KEYWORDS,
  CATEGORY_LABELS,
  CATEGORY_EMOJI,
  CATEGORY_ICON_KEYS,
  nameOrTypeMatches,
} from '../shared/placeCategories';

/**
 * Quick Chips — data + matching logic. Originally ported from legacy's
 * `initQuickChips` IIFE (app.js ~6333–6932); rebuilt in this pass around
 * the person's explicit categorization spec (see
 * `features/shared/placeCategories.js`) and made admin-editable (see
 * `features/admin/quickChipsApi.js` + `QuickChipsTab.jsx`).
 *
 * What changed from the legacy-port version, and why:
 *   - Chips used to be a hardcoded 12-entry array here, matched against
 *     waypoints by tokenizing the chip's `query` string into words and
 *     comparing against a `KW_MAP` of type-only synonyms. That missed
 *     anything whose *name* carried the signal but whose stored `type`
 *     didn't ("Paradise Lodge" typed `off_campus_lodge`, which was never
 *     in any chip's type-synonym set, so it could never appear under
 *     "Hostel").
 *   - Now: a place counts toward a chip if its NAME *or* its raw stored
 *     TYPE contains any of that chip's keywords, exactly per spec ("if
 *     the tag has any one of them — name or tag bearing it — bring it
 *     on"). `nameOrTypeMatches` (shared/placeCategories.js) is the one
 *     place that rule lives, so admin-panel classification and chip
 *     matching can never drift apart.
 *   - Chips are no longer hardcoded: `DEFAULT_CHIPS` below seeds the 16
 *     categories the person asked for, but the live list an admin has
 *     edited (renamed, re-keyworded, added, removed, or individually
 *     pinned/excluded a place from) comes from `useQuickChips()` —
 *     QuickChips.jsx/ChipResultsPanel.jsx now receive `chips` as a prop
 *     instead of importing a static `CHIPS` constant.
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
  bursary: '#7F77DD', student_affairs: '#7F77DD', toilet: '#38BDF8',
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
  toilet: '🚻',
};
export function typeEmoji(t, fallback) {
  return TYPE_EMOJI[t] || fallback || '📍';
}

export function fmtDist(m) {
  if (m < 50) return 'Very close';
  if (m < 1000) return Math.round(m) + 'm away';
  return (m / 1000).toFixed(1) + 'km away';
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

function normType(t) {
  return (t || '').trim().toLowerCase();
}

/**
 * The 16 default chips, generated straight from
 * `features/shared/placeCategories.js` so the labels/keywords used here
 * can never drift out of sync with the admin-panel classification rules.
 * `id` is stable (matches the underlying place-type key) — used as the
 * row key in `quick_chips` once an admin edits/removes/re-adds one, and
 * as the React key while chips are still just this in-memory default.
 */
export const DEFAULT_CHIPS = CHIP_DISPLAY_ORDER.map((key) => ({
  id: key,
  label: CATEGORY_LABELS[key],
  emoji: CATEGORY_EMOJI[key],
  iconKey: CATEGORY_ICON_KEYS[key],
  keywords: CATEGORY_KEYWORDS[key],
  pinnedIds: [],
  excludedIds: [],
  isCustom: false,
}));

/**
 * Ports `gatherResults` (app.js ~6471–6543), rebuilt around per-chip
 * keyword substring matching (see file header) instead of a shared
 * free-text query string. `chip` is one entry from `DEFAULT_CHIPS` or
 * `useQuickChips()`'s live list: `{ keywords, pinnedIds, excludedIds }`.
 *
 * Pass 1 walks `waypoints` (Slice 2 already attaches `imageUrls` per
 * item, so no DOM reach-through needed, unlike legacy's marker-walk).
 * Pass 2 catches KML-only points by scanning `searchIndex.indexRef`
 * directly — see its own comment below for why this isn't routed through
 * `searchIndex.query()` — still requiring the exact same name/type
 * keyword match as Pass 1 rather than any fuzzy scoring: a chip's
 * results should mean one consistent thing.
 */
export function gatherResults(chip, { waypoints, searchIndex }) {
  if (!chip) return [];
  const keywords = chip.keywords || [];
  const pinned = new Set(chip.pinnedIds || []);
  const excluded = new Set(chip.excludedIds || []);
  const user = getUserLatLng();
  const seen = new Set();
  const out = [];

  (waypoints || []).forEach((wp) => {
    if (!wp.lat || !wp.lng) return;
    if (wp.id != null && excluded.has(wp.id)) return;
    const raw = (wp.name || '').trim();
    if (!raw) return;
    const isPinned = wp.id != null && pinned.has(wp.id);
    if (!isPinned && !nameOrTypeMatches(wp.name, wp.type, keywords)) return;
    const nameLow = raw.toLowerCase();
    if (seen.has(nameLow)) return;
    seen.add(nameLow);

    const dist = user ? distanceTo(user.lat, user.lng, wp.lat, wp.lng) : null;
    out.push({
      id: wp.id,
      name: raw,
      type: normType(wp.type),
      lat: wp.lat,
      lng: wp.lng,
      desc: wp.description || '',
      imageUrls: wp.imageUrls || [],
      dist,
    });
  });

  // Pass 2: KML-only named points (StaticKmlLayer's annotations aren't in
  // `waypoints`, only in `searchIndex`).
  //
  // Reads `searchIndex.indexRef.current` directly and applies the exact
  // same substring rule as Pass 1, rather than going through
  // `searchIndex.query()`. `query()` is a *scored, top-N* fuzzy search
  // built for a person typing into a search box — it gives Supabase
  // waypoints a flat scoring bonus over KML entries and caps results
  // (useSearchIndex.js's `score()`/`query()`), so on a large campus with
  // a generic chip keyword ("shopping", "spot"...) a real KML match could
  // rank below 30 competing waypoint names and get silently dropped even
  // though it's a genuine match. Scanning the raw index has no such cap —
  // every KML point gets checked, same as every waypoint does in Pass 1.
  const rawIndex = searchIndex?.indexRef?.current;
  if (keywords.length && rawIndex) {
    rawIndex.forEach((r) => {
      if (r.source !== 'kml') return; // waypoints already covered by Pass 1; skip segments
      if (r.id != null && excluded.has(r.id)) return;
      const lat = parseFloat(r.lat);
      const lng = parseFloat(r.lng);
      if (!lat || !lng) return;
      const key = (r.name || '').toLowerCase().trim();
      if (!key || seen.has(key)) return;
      if (!nameOrTypeMatches(r.name, r.subtype, keywords)) return;
      seen.add(key);

      const dist = user ? distanceTo(user.lat, user.lng, lat, lng) : null;
      out.push({
        id: r.id,
        name: r.name,
        type: 'landmark', // matches StaticKmlLayer's own tagging for these markers
        lat,
        lng,
        desc: r.desc || '',
        imageUrls: [],
        dist,
      });
    });
  }

  out.sort((a, b) => {
    if (a.dist === null && b.dist === null) return a.name.localeCompare(b.name);
    if (a.dist === null) return 1;
    if (b.dist === null) return -1;
    return a.dist - b.dist;
  });

  return out;
}
