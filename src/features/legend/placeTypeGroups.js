// ── Place-type filter groupings ──────────────────────────────────────────────
// Ported verbatim from legacy `index.html` lines ~133–436 (markup/order/labels)
// and `app.js` `initPlaceTypeFilter`'s `PTF_GROUPS` map (~6157–6166).
// Do not add/rename/reorder without checking the legacy source first —
// see CLAUDE.md's "never guess at legacy behavior" rule.

// ── Group → member types (exact copy of legacy PTF_GROUPS) ─────────────────
// NOTE: 'gates' includes entrance/hazard/junction, which have no legend row
// in the HTML (legacy quirk, not a porting omission) — they still default
// to visible via the same fallback the counts/visibility logic uses.
export const PTF_GROUPS = {
  academic: ['lecture_hall', 'faculty', 'laboratory', 'workshop', 'library'],
  administration: ['senate', 'admin', 'bursary', 'student_affairs'],
  residential: ['hostel', 'staff_quarters'],
  commercial: [
    'shopping', 'kiosk', 'printing_shop', 'cafe', 'restaurant',
    'pharmacy', 'barber', 'laundry', 'fuel', 'bank',
  ],
  recreational: ['sports', 'hall', 'clinic', 'auditorium'],
  operational: ['garage', 'bus_stop', 'utility', 'security_post'],
  religious: ['mosque', 'chapel'],
  gates: ['gate', 'landmark', 'poi', 'entrance', 'hazard', 'junction'],
};

// ── Group display metadata — order matters, matches legacy DOM order ───────
export const GROUP_META = [
  { key: 'academic', name: 'Academic', swatch: '#378ADD' },
  { key: 'administration', name: 'Administration', swatch: '#7F77DD' },
  { key: 'residential', name: 'Residential', swatch: '#EF9F27' },
  { key: 'commercial', name: 'Commercial', swatch: '#D85A30' },
  { key: 'recreational', name: 'Recreational & Health', swatch: '#D4537E' },
  { key: 'operational', name: 'Operational & Utilities', swatch: '#888780' },
  { key: 'religious', name: 'Religious', swatch: '#FAC775' },
  { key: 'gates', name: 'Gates & Campus Zones', swatch: '#E24B4A' },
];

// ── Per-type rows within each group: [type, display name, row swatch] ──────
// IMPORTANT: these swatch colors are the legend's OWN color map, and are
// NOT the same as wpTypeMeta.js's WP_TYPE_COLORS (marker pin color).
// Legacy's index.html legend gives printing_shop/cafe/restaurant/pharmacy/
// barber/laundry/fuel/security_post distinct swatch colors here, but the
// actual map pins for those types (app.js WP_TYPE_COLORS) fall back to the
// default teal — a genuine inconsistency in the legacy app, not a porting
// error. Ported faithfully; flag to the person if this should be unified.
export const GROUP_ROWS = {
  academic: [
    ['lecture_hall', 'Lecture Hall / LT', '#378ADD'],
    ['faculty', 'Faculty Building', '#185FA5'],
    ['laboratory', 'Laboratory', '#5DCAA5'],
    ['workshop', 'Workshop / Studio', '#1D9E75'],
    ['library', 'Library', '#9FE1CB'],
  ],
  administration: [
    ['senate', 'Senate Building', '#7F77DD'],
    ['admin', 'Admin / Registry', '#AFA9EC'],
    ['bursary', 'Bursary / Finance', '#CECBF6'],
    ['student_affairs', 'Student Affairs', '#534AB7'],
  ],
  residential: [
    ['hostel', 'Student Hostel / Hall', '#EF9F27'],
    ['staff_quarters', 'Staff Quarters', '#BA7517'],
  ],
  commercial: [
    ['shopping', 'Shopping Complex', '#D85A30'],
    ['kiosk', 'Kiosk / Canteen', '#F0997B'],
    ['printing_shop', 'Print Shop / Business Centre', '#6366F1'],
    ['cafe', 'Café / Snack Bar', '#F97316'],
    ['restaurant', 'Restaurant / Eatery', '#EF4444'],
    ['pharmacy', 'Pharmacy / Chemist', '#EC4899'],
    ['barber', 'Barber / Salon', '#0EA5E9'],
    ['laundry', 'Laundry Service', '#06B6D4'],
    ['fuel', 'Fuel Station', '#84CC16'],
    ['bank', 'Bank / ATM', '#993C1D'],
  ],
  recreational: [
    ['sports', 'Sports Facility', '#D4537E'],
    ['hall', 'Multipurpose Hall', '#ED93B1'],
    ['clinic', 'Clinic / Health Centre', '#F4C0D1'],
    ['auditorium', 'Auditorium', '#993556'],
  ],
  operational: [
    ['garage', 'Garage / Car Park', '#888780'],
    ['bus_stop', 'Bus Stop', '#5F5E5A'],
    ['utility', 'Utility / Power Station', '#B4B2A9'],
    ['security_post', 'Security Post', '#64748B'],
  ],
  religious: [
    ['mosque', 'Mosque', '#FAC775'],
    ['chapel', 'Chapel / Church', '#EF9F27'],
  ],
  gates: [
    ['gate', 'Gate / Entrance', '#E24B4A'],
    ['landmark', 'Landmark', '#AFA9EC'],
    ['poi', 'Point of Interest', '#5DCAA5'],
  ],
};

// ── Resolve which group a type belongs to (mirrors legacy `_groupOf`) ──────
export function groupOfType(type) {
  for (const [group, types] of Object.entries(PTF_GROUPS)) {
    if (types.includes(type)) return group;
  }
  return null;
}

export const ALL_TYPES = Object.values(PTF_GROUPS).flat();
