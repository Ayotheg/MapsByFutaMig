// Ported verbatim from legacy app.js ~2459–2496 (`WP_ALL_TYPES`) — the
// ordered [value, label] list used by the admin "Type" `<select>` in both
// the edit-waypoint form and the add-point form. Order matters (it's the
// dropdown's visual order), so this isn't derived from `wpTypeMeta.js`'s
// `WP_TYPE_LABELS` object (whose key order isn't a contract) — kept as its
// own explicit list, same as legacy.
//
// One real difference from `WP_TYPE_LABELS`: legacy's dropdown list omits
// `entrance` (which exists in `WP_TYPE_LABELS` but was seemingly dropped
// from the selectable-types list — `gate` already covers the same
// "Gate / Entrance" wording). Kept faithfully missing here too.
export const WP_ALL_TYPES = [
  ['lecture_hall', 'Lecture Hall'],
  ['faculty', 'Faculty Building'],
  ['laboratory', 'Laboratory'],
  ['workshop', 'Workshop / Studio'],
  ['library', 'Library'],
  ['senate', 'Senate Building'],
  ['admin', 'Admin / Registry'],
  ['bursary', 'Bursary / Finance'],
  ['student_affairs', 'Student Affairs'],
  ['hostel', 'Student Hostel'],
  ['staff_quarters', 'Staff Quarters'],
  ['shopping', 'Shopping Complex'],
  ['kiosk', 'Kiosk / Canteen'],
  ['printing_shop', 'Print Shop / Business Centre'],
  ['cafe', 'Café / Snack Bar'],
  ['restaurant', 'Restaurant / Eatery'],
  ['pharmacy', 'Pharmacy / Chemist'],
  ['barber', 'Barber / Salon'],
  ['laundry', 'Laundry Service'],
  ['fuel', 'Fuel Station'],
  ['bank', 'Bank / ATM'],
  ['sports', 'Sports Facility'],
  ['hall', 'Multipurpose Hall'],
  ['clinic', 'Clinic / Health Centre'],
  ['auditorium', 'Auditorium'],
  ['garage', 'Garage / Car Park'],
  ['bus_stop', 'Bus Stop'],
  ['utility', 'Utility / Power'],
  ['security_post', 'Security Post'],
  ['mosque', 'Mosque'],
  ['chapel', 'Chapel / Church'],
  ['gate', 'Gate / Entrance'],
  ['landmark', 'Landmark'],
  ['poi', 'Point of Interest'],
  ['hazard', 'Hazard'],
  ['junction', 'Junction'],
];
