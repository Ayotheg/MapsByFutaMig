// ── Place-type dropdown options ──────────────────────────────────────────
// Consolidated from the original 38-entry legacy-ported list down to 24
// broad buckets, based on real DB usage data (three count/name queries run
// against the live `waypoints` table — see chat/migration for the full
// reasoning per merge) plus the person's own experience of having to
// force-fit real campus places (gas shops, car washes, footwear, clothing)
// into whatever was closest, because no correct option existed.
//
// Two-layer model this list is part of:
//   - `type` (this list): "what does the pin look like" — kept broad on
//     purpose, so it never runs out of the same way again.
//   - Quick Chip categories (`shared/placeCategories.js`'s
//     CATEGORY_KEYWORDS): "what can someone search for" — carries all the
//     specific vocabulary (shawarma, car wash, footwear, gas...) via
//     keyword-matching against the waypoint's NAME, so consolidating `type`
//     doesn't lose any search precision.
//
// Merges folded into this list (old → new):
//   admin       ← senate, bursary, student_affairs, admin, government, office
//   food        ← cafe, restaurant, kiosk, fast_food
//   shop        ← shopping, furniture, barber, laundry, convenience, beauty,
//                 hairdresser, clothes, shoes, mobile_phone, computer,
//                 interior_decoration, supermarket, beverages, vending_machine,
//                 + gas shops / car washes previously force-fit into
//                 utility/landmark (this is the bucket that fixes that)
//   hall        ← hall, auditorium, arts_centre, social_centre
//   clinic      ← clinic, pharmacy, hospital, chemist
//   hostel      ← hostel, dormitory, off_campus_lodge, townhall (confirmed by
//                 name to be student-accommodation naming, not event halls)
//   infrastructure ← utility, security_post/security, police, fire_station,
//                 warehouse, parking, parking_space
//   landmark    ← landmark, poi, hazard, junction, and the true unclassifiable
//                 remainder of the old OSM-import garbage types
//   gate        ← gate, entrance (entrance was already dead/unselectable)
// See waypoint_type_migration.sql for the full DB-side mapping.
export const WP_ALL_TYPES = [
  // Academic
  ['lecture_hall', 'Lecture Hall'],
  ['faculty', 'Faculty Building'],
  ['laboratory', 'Laboratory'],
  ['workshop', 'Workshop / Studio'],
  ['library', 'Library'],

  // Administration
  ['admin', 'Admin / Registry'],

  // Residential
  ['hostel', 'Student Hostel'],
  ['staff_quarters', 'Staff Quarters'],

  // Commercial
  ['food', 'Food & Drinks'],
  ['shop', 'Shop / Services'],
  ['printing_shop', 'Print Shop / Business Centre'],
  ['fuel', 'Fuel Station'],
  ['bank', 'Bank / ATM'],

  // Recreational & health
  ['sports', 'Sports Facility'],
  ['hall', 'Multipurpose Hall'],
  ['clinic', 'Clinic / Health Centre'],
  ['toilet', 'Toilet / Restroom'],

  // Operational
  ['garage', 'Garage / Motor Park'],
  ['bus_stop', 'Bus Stop'],
  ['infrastructure', 'Infrastructure / Utility'],

  // Religious
  ['mosque', 'Mosque'],
  ['chapel', 'Chapel / Church'],

  // Gates & campus zones
  ['gate', 'Gate / Entrance'],
  ['landmark', 'Landmark'],
];
