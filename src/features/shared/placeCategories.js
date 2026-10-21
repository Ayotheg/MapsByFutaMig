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
//
// Sept 2026 addition: the underlying `type` field was consolidated from
// 38 raw values down to 24 broad buckets (see `wpTypeMeta.js`/
// `adminTypeOptions.js`). Several of the merged-away types (gas shops,
// car washes, footwear, clothing, furniture, barber, laundry, fuel) had
// no chip of their own before — this is the fix for that, and the reason
// it's *possible* without adding back dropdown clutter: chip categories
// match on NAME as much as TYPE, so a broad `type: 'shop'` waypoint named
// "FUTA Car Wash" still resolves to the `car_wash` chip correctly. New
// keys added below this line: shawarma, footwear, clothing, gas, fuel,
// furniture, barber, laundry, car_wash.
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
  'shawarma',
  'car_wash',
  'footwear',
  'clothing',
  'gas',
  'fuel',
  'furniture',
  'barber',
  'laundry',
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
// appear in"). New chips appended at the end rather than interleaved, so
// the original 16 stay where admins already expect them.
//
// Oct 2026 (Quick Chips revamp): this is now the order the "All places"
// screen lists them in, group by group. The top bar has its own order
// (DEFAULT_BAR_CHIPS below).
export const CHIP_DISPLAY_ORDER = [
  // Study
  'lecture_hall',
  'faculty',
  'library',
  'printing_shop',
  // Food & chops
  'restaurant',
  'kiosk',
  'shawarma',
  // Daily essentials
  'bank',
  'toilet',
  'bus_stop',
  'gate',
  'clinic',
  // Hostel life
  'hostel',
  'laundry',
  'gas',
  'furniture',
  // Fix & style
  'barber',
  'footwear',
  'clothing',
  'car_wash',
  'garage',
  'fuel',
  // Faith & fun
  'chapel',
  'mosque',
  'sports',
];

// Keyword lists ported directly from the person's spec (original 16),
// plus the Sept 2026 additions covering what `type` consolidation folded
// into the new `shop`/`food` buckets. Matching is substring-based against
// a normalized "name + type" string (underscores -> spaces, lowercased),
// so "off_campus_lodge" as a TYPE matches the `hostel` category's "lodge"
// keyword, and "Redemption Mansion Lodge" as a NAME matches it too —
// either one bearing the keyword is enough.
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

  // ── Sept 2026 additions — see CHIP_CATEGORY_KEYS header note ──────────
  shawarma: ['shawarma'],
  car_wash: ['car wash', 'carwash'],
  footwear: ['footwear', 'shoe', 'shoes'],
  clothing: ['clothes', 'clothing', 'boutique', 'wears'],
  // 'gas' here means cooking-gas refill (common campus shop type),
  // deliberately separate from 'fuel' (petrol/diesel stations) below —
  // confirmed distinct in the person's own DB data.
  gas: ['gas shop', 'cooking gas', 'gas refill', ' gas '],
  fuel: ['fuel', 'petrol', 'diesel', 'filling station'],
  furniture: ['furniture'],
  barber: ['barber', 'salon', 'hairdresser', 'barbing'],
  laundry: ['laundry', 'dry clean', 'dry cleaning'],
};

// Display metadata for the Quick Chips (label/icon). `iconKey` looks up
// `lib/legacyIconMap.js`; every category has one, so there's no emoji
// fallback to fall back to anymore.
//
// Oct 2026 Quick Chips revamp: wording follows the "All places" screen
// (plural, sentence case — "Toilets", "Gates & entrances").
export const CATEGORY_LABELS = {
  toilet: 'Toilets',
  hostel: 'Hostels & lodges',
  printing_shop: 'Printing',
  garage: 'Garage',
  library: 'Library',
  kiosk: 'Kiosks',
  bank: 'POS / ATM',
  chapel: 'Churches',
  bus_stop: 'Bus stops',
  gate: 'Gates & entrances',
  clinic: 'Clinic',
  restaurant: 'Canteens',
  mosque: 'Mosques',
  sports: 'Sports',
  lecture_hall: 'Lecture halls',
  faculty: 'Faculties',
  shawarma: 'Shawarma',
  car_wash: 'Car wash',
  footwear: 'Footwear',
  clothing: 'Clothing',
  gas: 'Gas shops',
  fuel: 'Filling stations',
  furniture: 'Furniture',
  barber: 'Salons',
  laundry: 'Laundry & dry cleaners',
};

// Shorter names the top chip bar uses where the screen shortens them
// ("Food", "Hostels"); the All places panel always shows the full label.
export const CATEGORY_SHORT_LABELS = {
  restaurant: 'Food',
  hostel: 'Hostels',
};

// The chips the top bar shows, in order (the screen's "Lecture halls ·
// Food · Printing · POS / ATM · Hostels · All places"). Admins can change
// this from the Chips tab — it's `quick_chips.bar_order`.
export const DEFAULT_BAR_CHIPS = ['lecture_hall', 'restaurant', 'printing_shop', 'bank', 'hostel'];

// Kept in step with lib/typeIcons.js so a chip and its results' fallback
// icons match.
export const CATEGORY_ICON_KEYS = {
  toilet: 'toilet',
  hostel: 'house-door-fill',
  printing_shop: 'printer-fill',
  garage: 'car-front',
  library: 'library-big',
  kiosk: 'shop',
  bank: 'credit-card', // the "POS / ATM" chip
  chapel: 'church',
  bus_stop: 'bus-front-fill',
  gate: 'gate-barrier', // no direct Lucide icon reads as a campus vehicle
                         // gate (Fence/DoorOpen don't fit) — custom SVG,
                         // see lib/GateIcon.jsx
  clinic: 'stethoscope',
  restaurant: 'utensils',
  mosque: 'mosque',
  sports: 'football',
  lecture_hall: 'graduation-cap',
  faculty: 'school',
  shawarma: 'restaurant-fill', // no dedicated shawarma icon in the inventory
  car_wash: 'car-front',
  footwear: 'shop', // no dedicated footwear/shoe icon in legacyIconMap.js
  clothing: 'shop', // no dedicated clothing icon in legacyIconMap.js
  gas: 'fuel', // closest available icon; distinct chip from `fuel` by keyword
  fuel: 'fuel',
  furniture: 'armchair',
  barber: 'scissors',
  laundry: 'washing-machine',
};

// ── Chip categories (Oct 2026 Quick Chips revamp) ────────────────────────
// The "All places" panel groups every chip under one of these headings,
// in this order, and the admin "Chips" tab picks one when creating a chip
// (stored as `quick_chips.category` — see supabase/quick_chip_categories.sql).
// Exactly the six headings on the "All places" screen. `other` isn't one
// of them: it only catches a chip with no category yet, renders last, and
// isn't offered in the admin picker.
export const CHIP_GROUPS = [
  { key: 'study', label: 'Study' },
  { key: 'food', label: 'Food & chops' },
  { key: 'essentials', label: 'Daily essentials' },
  { key: 'hostel_life', label: 'Hostel life' },
  { key: 'fix_style', label: 'Fix & style' },
  { key: 'faith_fun', label: 'Faith & fun' },
  { key: 'other', label: 'Other' },
];
export const PICKABLE_CHIP_GROUPS = CHIP_GROUPS.filter((g) => g.key !== 'other');

const GROUP_KEYS = new Set(CHIP_GROUPS.map((g) => g.key));

// Category for each built-in chip — used by DEFAULT_CHIPS and as the
// fallback for a `quick_chips` row whose `category` column is still empty
// (or doesn't exist yet, before the migration is run).
export const DEFAULT_CHIP_GROUP = {
  lecture_hall: 'study',
  faculty: 'study',
  library: 'study',
  printing_shop: 'study',
  restaurant: 'food',
  kiosk: 'food',
  shawarma: 'food',
  bank: 'essentials',
  toilet: 'essentials',
  bus_stop: 'essentials',
  gate: 'essentials',
  clinic: 'essentials',
  hostel: 'hostel_life',
  laundry: 'hostel_life',
  gas: 'hostel_life',
  furniture: 'hostel_life',
  barber: 'fix_style',
  footwear: 'fix_style',
  clothing: 'fix_style',
  car_wash: 'fix_style',
  garage: 'fix_style',
  fuel: 'fix_style',
  chapel: 'faith_fun',
  mosque: 'faith_fun',
  sports: 'faith_fun',
};

/** A chip's category key — its own `category` if it's a known one,
 * else the built-in default for its id, else `other`. */
export function chipGroupOf(chip) {
  if (chip?.category && GROUP_KEYS.has(chip.category)) return chip.category;
  return DEFAULT_CHIP_GROUP[chip?.id] || 'other';
}

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
