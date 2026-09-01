// ── Place-type metadata ──────────────────────────────────────────────────────
// Consolidated (Sept 2026) from the original 38-entry legacy-ported list down
// to 24 broad buckets — see `adminTypeOptions.js`'s header for the full old→new
// merge table and reasoning, and `waypoint_type_migration.sql` for the DB-side
// migration this depends on. Every merged-in type below picks one of its
// source colors/labels rather than inventing new ones, except where noted.
import { classifyPlace } from '../shared/placeCategories';

// ── Place-type → pin colour map ─────────────────────────────────────────────
// Previously several real dropdown types (printing_shop, cafe, restaurant,
// pharmacy, barber, laundry, fuel, security_post) had NO entry here and
// silently fell back to WP_DEFAULT_COLOR — a legacy gap, not a porting error.
// Fixed now as part of the consolidation: every one of the 24 types below
// gets a real, intentional color.
//
// One deliberate change from straight legacy-color-reuse: `chapel` used to
// share hostel's exact color (#EF9F27) — a genuine legacy pin-color collision,
// not something a person tagging by pin color could tell apart. Given colors
// on 21 of 24 types anyway, fixed it here rather than perpetuating it.
export const WP_TYPE_COLORS = {
  lecture_hall: '#378ADD',
  faculty: '#185FA5',
  laboratory: '#5DCAA5',
  workshop: '#1D9E75',
  library: '#9FE1CB',
  admin: '#7F77DD',
  hostel: '#EF9F27',
  staff_quarters: '#BA7517',
  food: '#F97316',
  shop: '#D85A30',
  printing_shop: '#6366F1',
  fuel: '#84CC16',
  bank: '#993C1D',
  sports: '#D4537E',
  hall: '#ED93B1',
  clinic: '#F4C0D1',
  toilet: '#38BDF8',
  garage: '#888780',
  bus_stop: '#5F5E5A',
  infrastructure: '#B4B2A9',
  mosque: '#FAC775',
  chapel: '#C084FC', // was #EF9F27 (collided with hostel) — see header note
  gate: '#E24B4A',
  landmark: '#AFA9EC',
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
  admin: 'Admin / Registry',
  hostel: 'Student Hostel',
  staff_quarters: 'Staff Quarters',
  food: 'Food & Drinks',
  shop: 'Shop / Services',
  printing_shop: 'Print Shop / Business Centre',
  fuel: 'Fuel Station',
  bank: 'Bank / ATM',
  sports: 'Sports Facility',
  hall: 'Multipurpose Hall',
  clinic: 'Clinic / Health Centre',
  toilet: 'Toilet',
  garage: 'Garage / Motor Park',
  bus_stop: 'Bus Stop',
  infrastructure: 'Infrastructure / Utility',
  mosque: 'Mosque',
  chapel: 'Chapel / Church',
  gate: 'Gate / Entrance',
  landmark: 'Landmark',
};

// ── Rateable "Point of Interest" service types ──────────────────────────────
// When navigation ends at one of these, legacy prompts a review (Slice 8).
// Updated to the merged types: `food` and `shop` replace the old
// cafe/restaurant/kiosk/pharmacy/barber/laundry/shopping/furniture entries —
// same rateable *intent* (a service/commerce stop), just under the new
// broader type names.
export const POI_RATEABLE_TYPES = new Set([
  'printing_shop', 'food', 'shop', 'fuel', 'bank',
]);

export function isRateablePOI(type) {
  return POI_RATEABLE_TYPES.has(type);
}

// ── Resolve a waypoint's *displayed* type ────────────────────────────────
// Bug this fixes: a chunk of imported waypoints carry a raw `type` that was
// never a real option in this app's own Type dropdown (WP_ALL_TYPES) —
// leftovers from an earlier OSM/legacy import. The admin list badge used to
// print that raw string verbatim while the Edit modal's `<select>` — which
// only knows the curated option list — quietly fell back to its first
// option, so the badge and the "Type" shown on Edit disagreed with each
// other for the same waypoint.
//
// This resolves what a waypoint's type *should* display as: keep it as-is
// if it's already one of this app's real options; otherwise guess from
// name+type via `classifyPlace` (the same rule Quick Chips use); otherwise
// fall back to `landmark` (never raw garbage like "yes"). Both
// `PointsTab.jsx`'s badge and `AdminEditModal.jsx`'s pre-selected dropdown
// value call this, so they always show the same thing — and saving the form
// writes the resolved value back, self-healing the bad data the next time
// each point is touched. This is also the mechanism that lets the person
// manually reclassify any row the SQL migration guessed wrong on, just by
// opening it in admin and picking the correct type.
export function resolveWaypointType(wp) {
  const raw = (wp?.type || '').trim().toLowerCase();
  if (raw && WP_TYPE_LABELS[raw]) return raw;
  return classifyPlace(wp?.name, wp?.type) || 'landmark';
}
