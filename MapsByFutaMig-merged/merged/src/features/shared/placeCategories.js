// ── Shared place-category rules ──────────────────────────────────────────
//
// Single source of truth for "what kind of place is this", used by BOTH:
//   1. the admin panel (badge text + the Type dropdown's pre-selected
//      value in AdminEditModal.jsx) — fixes the bug where a waypoint's
//      raw `type` (often garbage imported from OSM/legacy data — "yes",
//      "off_campus_lodge", "arts_centre", "townhall", "farm"…) doesn't
//      exist in the curated dropdown list, so the badge shown in the
//      points list and the type shown when you open "Edit" silently
//      disagree with each other.
//   2. Quick Chips (`chipConfig.js`) — a place counts toward a chip if
//      its NAME *or* its raw stored TYPE contains one of that category's
//      keywords, exactly per the person's spec: "based on names/tag
//      whatever they possess; if the tag has any one of them bring it on."
//
// Each category key below is deliberately the SAME string as the
// matching entry in `wpTypeMeta.js`/`adminTypeOptions.js` wherever one
// already existed (hostel, printing_shop, garage, library, kiosk, bank,
// chapel, bus_stop, gate, clinic, restaurant, mosque, sports,
// lecture_hall, faculty) — only `toilet` is genuinely new. So resolving
// a waypoint to a category and writing that back as its `type` on save
// is always a valid, already-supported value; nothing new to migrate.
//
// Order of CHIP_CATEGORY_KEYS matters: it's the priority a place is
// tested in when its name/type could plausibly match more than one
// category. Narrow, specific keywords go first; broad catch-alls like
// `kiosk` ("shop", "spot", "shopping") go last so they don't steal
// matches that a more specific category should have owned.
export const CHIP_CATEGORY_KEYS = [
  'toilet',
  'mosque',
  'chapel',
  'clinic',
  'library',
  'printing_shop',
  'garage',
  'bus_stop',
  'gate',
  'bank',
  'restaurant',
  'sports',
  'lecture_hall',
  'faculty',
  'hostel',
  'kiosk',
];

// Display order for the Quick Chips bar — the order the person listed
// them in, which is deliberately NOT the same as the classification
// priority order above (that one's optimized to avoid false-positive
// overlaps between categories, this one's just "what order do the chips
// appear in").
export const CHIP_DISPLAY_ORDER = [
  'toilet',
  'hostel',
  'printing_shop',
  'garage',
  'library',
  'kiosk',
  'bank',
  'chapel',
  'bus_stop',
  'gate',
  'clinic',
  'restaurant',
  'mosque',
  'sports',
  'lecture_hall',
  'faculty',
];

// Keyword lists ported directly from the person's spec. Matching is
// substring-based against a normalized "name + type" string (underscores
// -> spaces, lowercased), so "off_campus_lodge" as a TYPE matches the
// `hostel` category's "lodge" keyword, and "Redemption Mansion Lodge" as
// a NAME matches it too — either one bearing the keyword is enough.
export const CATEGORY_KEYWORDS = {
  toilet: ['toilet', 'restroom'],
  hostel: ['hostel', 'lodges', 'lodge', 'hall of residence', 'off campus lodge'],
  printing_shop: ['printing', 'printing press', 'printing shop', 'print shop', 'print press'],
  garage: ['garage'],
  library: ['library', 'bookshop', 'book shop'],
  kiosk: ['kiosk', 'shopping', 'spot', 'futa bread', 'shopping complex'],
  bank: ['bank', 'pos', 'atm', 'cooperative', 'cooperatives', 'finance'],
  chapel: [
    'fellowship',
    'church',
    'place of worship',
    'church of god',
    'campus fellowship',
    'postgraduate fellowship',
    'chapel',
  ],
  bus_stop: ['bus station', 'bus stop', 'bus park', 'shuttle bus station', 'shuttle bus'],
  gate: ['gate', 'entrance'],
  clinic: ['clinic', 'hospital', 'health center', 'health centre', 'pharmacy'],
  restaurant: ['restaurant', 'eatery', 'canteen'],
  mosque: ['mosque'],
  sports: ['gym', 'gym center', 'gym centre', 'pitch', 'sport complex', 'sports complex', 'sport'],
  lecture_hall: ['lecture halls', 'lecture hall', 'lecture theatre', 'lecture theater'],
  faculty: ['faculty'],
};

// Display metadata for the 16 default Quick Chips (label/icon).
// `iconKey` looks up `lib/legacyIconMap.js`; every category has one, so
// there's no emoji fallback to fall back to anymore.
export const CATEGORY_LABELS = {
  toilet: 'Toilet',
  hostel: 'Hostel / Lodges',
  printing_shop: 'Printing',
  garage: 'Garage',
  library: 'Library',
  kiosk: 'Kiosk',
  bank: 'POS / ATM',
  chapel: 'Church',
  bus_stop: 'Bus Stop',
  gate: 'Gates / Entrance',
  clinic: 'Clinic',
  restaurant: 'Canteen',
  mosque: 'Mosque',
  sports: 'Sports',
  lecture_hall: 'Lecture Halls',
  faculty: 'Faculty',
};

export const CATEGORY_ICON_KEYS = {
  toilet: 'toilet',
  hostel: 'house-door-fill',
  printing_shop: 'printer-fill',
  garage: 'bus-front-fill',
  library: 'building-fill',
  kiosk: 'shop',
  bank: 'bank2',
  chapel: 'church',
  bus_stop: 'bus-front-fill',
  gate: 'gate-barrier', // no direct Lucide icon reads as a campus vehicle
                         // gate (Fence/DoorOpen don't fit) — custom SVG,
                         // see lib/GateIcon.jsx
  clinic: 'hospital-fill',
  restaurant: 'restaurant-fill',
  mosque: 'mosque',
  sports: 'football',
  lecture_hall: 'building-fill',
  faculty: 'building-fill',
};

function norm(s) {
  return (s || '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True if `name`/`type` (name OR type, either is enough) contains any of
 * `keywords` as a substring. Shared by classification and chip matching
 * so both use exactly the same rule. */
export function nameOrTypeMatches(name, type, keywords) {
  if (!keywords || !keywords.length) return false;
  const haystack = norm(name) + ' ' + norm(type);
  return keywords.some((kw) => haystack.includes(norm(kw)));
}

/** Resolves a waypoint's name+raw-type to one of the 16 chip categories,
 * or null if nothing matches (caller decides the fallback — see
 * `resolveWaypointType` in wpTypeMeta.js for the admin-panel fallback
 * chain). Checked in `CHIP_CATEGORY_KEYS` priority order. */
export function classifyPlace(name, type) {
  for (const key of CHIP_CATEGORY_KEYS) {
    if (nameOrTypeMatches(name, type, CATEGORY_KEYWORDS[key])) return key;
  }
  return null;
}
