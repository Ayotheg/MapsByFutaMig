// ── Place-type metadata ──────────────────────────────────────────────────────
// Ported verbatim from legacy app.js (feature/login2), lines ~2367–2460.
// Do not add/rename/recolor entries without checking the legacy source first
// — see CLAUDE.md's "never guess at legacy behavior" rule.
//
// One deliberate, person-requested addition on top of the legacy port:
// `toilet` (color/label below, dropdown option in adminTypeOptions.js) —
// there was no "Toilet" type in legacy and the person explicitly asked
// for one. Also added: `resolveWaypointType()` below, used by the admin
// panel to fix a real bug — see its own comment.
import { classifyPlace } from '../shared/placeCategories';

// ── Place-type → pin colour map ─────────────────────────────────────────────
// NOTE: this is an exact copy of legacy's WP_TYPE_COLORS, including its gaps.
// Several types that exist in WP_TYPE_LABELS/WP_ALL_TYPES below (printing_shop,
// cafe, restaurant, pharmacy, barber, laundry, fuel, security_post) have no
// entry here in the legacy source either — they silently fall back to
// WP_DEFAULT_COLOR there, and do here too via wpColor(). Not an omission on
// this port's part; flag to the person if this should be filled in.
export const WP_TYPE_COLORS = {
  lecture_hall: '#378ADD',
  faculty: '#185FA5',
  laboratory: '#5DCAA5',
  workshop: '#1D9E75',
  library: '#9FE1CB',
  senate: '#7F77DD',
  admin: '#AFA9EC',
  bursary: '#CECBF6',
  student_affairs: '#534AB7',
  hostel: '#EF9F27',
  staff_quarters: '#BA7517',
  shopping: '#D85A30',
  kiosk: '#F0997B',
  bank: '#993C1D',
  sports: '#D4537E',
  hall: '#ED93B1',
  clinic: '#F4C0D1',
  auditorium: '#993556',
  garage: '#888780',
  bus_stop: '#5F5E5A',
  utility: '#B4B2A9',
  mosque: '#FAC775',
  chapel: '#EF9F27',
  gate: '#E24B4A',
  landmark: '#AFA9EC',
  entrance: '#E24B4A',
  hazard: '#E24B4A',
  junction: '#888780',
  poi: '#5DCAA5',
  toilet: '#38BDF8',
};
export const WP_DEFAULT_COLOR = '#00c896';

export function wpColor(type) {
  return WP_TYPE_COLORS[type] || WP_DEFAULT_COLOR;
}

// ── Type labels for the place-card badge & legacy popup ─────────────────────
// Plain text now — icon rendering for these types goes through
// `lib/typeIcons.js`'s `getTypeIcon()` instead of parsing an emoji back
// out of the label string.
export const WP_TYPE_LABELS = {
  lecture_hall: 'Lecture Hall',
  faculty: 'Faculty Building',
  laboratory: 'Laboratory',
  workshop: 'Workshop / Studio',
  library: 'Library',
  senate: 'Senate Building',
  admin: 'Admin / Registry',
  bursary: 'Bursary / Finance',
  student_affairs: 'Student Affairs',
  hostel: 'Student Hostel',
  staff_quarters: 'Staff Quarters',
  shopping: 'Shopping Complex',
  kiosk: 'Kiosk / Canteen',
  printing_shop: 'Print Shop / Business Centre',
  cafe: 'Café / Snack Bar',
  restaurant: 'Restaurant / Eatery',
  pharmacy: 'Pharmacy / Chemist',
  barber: 'Barber / Salon',
  laundry: 'Laundry Service',
  fuel: 'Fuel Station',
  bank: 'Bank / ATM',
  sports: 'Sports Facility',
  hall: 'Multipurpose Hall',
  clinic: 'Clinic / Health Centre',
  auditorium: 'Auditorium',
  garage: 'Garage / Car Park',
  bus_stop: 'Bus Stop',
  utility: 'Utility / Power',
  security_post: 'Security Post',
  mosque: 'Mosque',
  chapel: 'Chapel / Church',
  gate: 'Gate / Entrance',
  landmark: 'Landmark',
  entrance: 'Entrance / Gate',
  hazard: 'Hazard',
  junction: 'Junction',
  poi: 'Point of Interest',
  toilet: 'Toilet',
};

// ── Rateable "Point of Interest" service types ──────────────────────────────
// When navigation ends at one of these, legacy prompts a review (Slice 8).
// Kept here now so the place-card badge logic below already matches it.
export const POI_RATEABLE_TYPES = new Set([
  'printing_shop', 'cafe', 'restaurant', 'kiosk', 'shopping',
  'pharmacy', 'barber', 'laundry', 'fuel', 'bank',
]);

export function isRateablePOI(type) {
  return POI_RATEABLE_TYPES.has(type);
}

// ── Resolve a waypoint's *displayed* type ────────────────────────────────
// Bug this fixes: a chunk of the 475 imported waypoints carry a raw
// `type` that was never a real option in this app's own Type dropdown
// (WP_ALL_TYPES) — leftovers from an earlier OSM/legacy import: "yes",
// "off_campus_lodge", "arts_centre", "townhall", "farm", etc. The admin
// list badge used to print that raw string verbatim while the Edit
// modal's `<select>` — which only knows the curated option list — quietly
// fell back to its first option, so the badge and the "Type" shown on
// Edit disagreed with each other for the same waypoint.
//
// This resolves what a waypoint's type *should* display as: keep it as-is
// if it's already one of this app's real options; otherwise guess from
// name+type via `classifyPlace` (the same rule Quick Chips use); otherwise
// fall back to `landmark` (never "yes"). Both `PointsTab.jsx`'s badge and
// `AdminEditModal.jsx`'s pre-selected dropdown value call this, so they
// always show the same thing — and saving the form writes the resolved
// value back, self-healing the bad data the next time each point is
// touched.
export function resolveWaypointType(wp) {
  const raw = (wp?.type || '').trim().toLowerCase();
  if (raw && WP_TYPE_LABELS[raw]) return raw;
  return classifyPlace(wp?.name, wp?.type) || 'landmark';
}
