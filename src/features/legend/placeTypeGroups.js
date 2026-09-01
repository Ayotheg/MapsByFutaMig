// ── Place-type filter groupings ──────────────────────────────────────────────
// Updated (Sept 2026) for the 24-type consolidation — see
// `adminTypeOptions.js`'s header for the full old→new merge table. Group
// membership below just follows each merged type to whichever group its
// ingredients were already in (e.g. `food`/`shop` stay 'commercial' since
// cafe/restaurant/kiosk/shopping/furniture/barber/laundry all were).

// ── Group → member types ─────────────────────────────────────────────────
export const PTF_GROUPS = {
  academic: ['lecture_hall', 'faculty', 'laboratory', 'workshop', 'library'],
  administration: ['admin'],
  residential: ['hostel', 'staff_quarters'],
  commercial: ['shop', 'food', 'printing_shop', 'fuel', 'bank'],
  recreational: ['sports', 'hall', 'clinic', 'toilet'],
  operational: ['garage', 'bus_stop', 'infrastructure'],
  religious: ['mosque', 'chapel'],
  gates: ['gate', 'landmark'],
};

// ── Group display metadata — order matters, matches original DOM order ─────
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
// Swatches now match `wpTypeMeta.js`'s WP_TYPE_COLORS 1:1 — the legacy
// inconsistency where legend swatches and map-pin colors disagreed (flagged
// in the pre-consolidation version of this file and in BRAND_GUIDELINES.md)
// is resolved as a side effect of every type now having a real pin color.
export const GROUP_ROWS = {
  academic: [
    ['lecture_hall', 'Lecture Hall', '#378ADD'],
    ['faculty', 'Faculty Building', '#185FA5'],
    ['laboratory', 'Laboratory', '#5DCAA5'],
    ['workshop', 'Workshop / Studio', '#1D9E75'],
    ['library', 'Library', '#9FE1CB'],
  ],
  administration: [
    ['admin', 'Admin / Registry', '#7F77DD'],
  ],
  residential: [
    ['hostel', 'Student Hostel', '#EF9F27'],
    ['staff_quarters', 'Staff Quarters', '#BA7517'],
  ],
  commercial: [
    ['shop', 'Shop / Services', '#D85A30'],
    ['food', 'Food & Drinks', '#F97316'],
    ['printing_shop', 'Print Shop / Business Centre', '#6366F1'],
    ['fuel', 'Fuel Station', '#84CC16'],
    ['bank', 'Bank / ATM', '#993C1D'],
  ],
  recreational: [
    ['sports', 'Sports Facility', '#D4537E'],
    ['hall', 'Multipurpose Hall', '#ED93B1'],
    ['clinic', 'Clinic / Health Centre', '#F4C0D1'],
    ['toilet', 'Toilet / Restroom', '#38BDF8'],
  ],
  operational: [
    ['garage', 'Garage / Motor Park', '#888780'],
    ['bus_stop', 'Bus Stop', '#5F5E5A'],
    ['infrastructure', 'Infrastructure / Utility', '#B4B2A9'],
  ],
  religious: [
    ['mosque', 'Mosque', '#FAC775'],
    ['chapel', 'Chapel / Church', '#C084FC'],
  ],
  gates: [
    ['gate', 'Gate / Entrance', '#E24B4A'],
    ['landmark', 'Landmark', '#AFA9EC'],
  ],
};

// ── Resolve which group a type belongs to ───────────────────────────────
export function groupOfType(type) {
  for (const [group, types] of Object.entries(PTF_GROUPS)) {
    if (types.includes(type)) return group;
  }
  return null;
}

export const ALL_TYPES = Object.values(PTF_GROUPS).flat();
