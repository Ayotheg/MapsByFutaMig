// Sept 2026 redesign (Figma: MAPSBYFUTA / ADMIN PANEL, node 96:1641) — admin
// panel moved from the app's dark surface to its own light "console" look.
// Same type → color *mapping* as before (every key below is unchanged, and
// still resolves the same way `resolveWaypointType`/`badgeStyleFor` always
// did); only the actual color *values* changed, from translucent-on-dark
// tints to solid light-tint/border/text triples that read correctly on the
// new white cards. Hue families were kept close to their previous
// counterparts (e.g. hostel stays amber, toilet stays sky-blue, mosque
// stays green) so the badge a given type got before is still recognizably
// "the same color", just re-rendered for a light background.
//
// Each entry's `color` doubles as the tint for that type's icon-avatar
// circle in the list (see PointsTab.jsx / RoutesTab.jsx / KmlTab.jsx —
// `badgeStyleFor(type)`'s `background`/`borderColor` are reused there too),
// matching the Figma spec's per-category icon-swatch treatment.
export const ADMIN_BADGE_COLORS = {
  seg: { bg: '#f0fdfa', color: '#0f766e', border: 'rgba(153,246,228,0.6)' },
  road: { bg: '#f0fdfa', color: '#0f766e', border: 'rgba(153,246,228,0.6)' },
  kml: { bg: '#fffbeb', color: '#92400e', border: 'rgba(253,230,138,0.8)' },

  lecture_hall: { bg: '#eff6ff', color: '#1d4ed8', border: 'rgba(191,219,254,0.7)' },
  faculty: { bg: '#eef2ff', color: '#4338ca', border: 'rgba(199,210,254,0.7)' },
  laboratory: { bg: '#ecfdf5', color: '#047857', border: 'rgba(167,243,208,0.6)' },
  workshop: { bg: '#f0fdf4', color: '#15803d', border: 'rgba(187,247,208,0.7)' },
  library: { bg: '#ecfeff', color: '#0e7490', border: 'rgba(165,243,252,0.6)' },

  admin: { bg: '#eef2ff', color: '#4338ca', border: 'rgba(199,210,254,0.7)' },
  senate: { bg: '#eef2ff', color: '#4338ca', border: 'rgba(199,210,254,0.7)' },
  bursary: { bg: '#eef2ff', color: '#4338ca', border: 'rgba(199,210,254,0.7)' },
  student_affairs: { bg: '#eef2ff', color: '#4338ca', border: 'rgba(199,210,254,0.7)' },

  hostel: { bg: '#fffbeb', color: '#92400e', border: 'rgba(253,230,138,0.8)' },
  staff_quarters: { bg: '#fff7ed', color: '#9a3412', border: 'rgba(254,215,170,0.7)' },

  food: { bg: '#fff7ed', color: '#c2410c', border: 'rgba(254,215,170,0.7)' },
  shop: { bg: '#fefce8', color: '#854d0e', border: 'rgba(254,240,138,0.6)' },
  shopping: { bg: '#fff1f2', color: '#be123c', border: 'rgba(254,205,211,0.6)' },
  kiosk: { bg: '#fff1f2', color: '#be123c', border: 'rgba(254,205,211,0.6)' },
  bank: { bg: '#fafaf9', color: '#57534e', border: 'rgba(214,211,209,0.7)' },

  sports: { bg: '#fdf2f8', color: '#be185d', border: 'rgba(251,207,232,0.6)' },
  hall: { bg: '#fdf2f8', color: '#db2777', border: 'rgba(251,207,232,0.6)' },
  clinic: { bg: '#fef2f2', color: '#b91c1c', border: 'rgba(254,202,202,0.6)' },
  auditorium: { bg: '#fdf2f8', color: '#9d174d', border: 'rgba(251,207,232,0.6)' },
  toilet: { bg: '#f0f9ff', color: '#0369a1', border: 'rgba(186,230,253,0.6)' },

  garage: { bg: '#f8fafc', color: '#475569', border: 'rgba(226,232,240,0.7)' },
  bus_stop: { bg: '#f8fafc', color: '#475569', border: 'rgba(226,232,240,0.7)' },
  infrastructure: { bg: '#f8fafc', color: '#475569', border: 'rgba(226,232,240,0.7)' },
  utility: { bg: '#f8fafc', color: '#475569', border: 'rgba(226,232,240,0.7)' },

  mosque: { bg: '#ecfdf5', color: '#047857', border: 'rgba(167,243,208,0.6)' },
  chapel: { bg: '#faf5ff', color: '#7e22ce', border: 'rgba(233,213,255,0.6)' },

  gate: { bg: '#fef2f2', color: '#dc2626', border: 'rgba(254,202,202,0.6)' },
  entrance: { bg: '#fef2f2', color: '#dc2626', border: 'rgba(254,202,202,0.6)' },
  hazard: { bg: '#fef2f2', color: '#b91c1c', border: 'rgba(254,202,202,0.6)' },

  landmark: { bg: '#f5f3ff', color: '#7c3aed', border: 'rgba(221,214,254,0.8)' },
  poi: { bg: '#ecfdf5', color: '#059669', border: 'rgba(167,243,208,0.6)' },
  junction: { bg: '#f8fafc', color: '#475569', border: 'rgba(226,232,240,0.7)' },

  // Channel entries (supabase/channel_entries.sql) — reuses the same
  // teal family as `seg`/`road` above (a fixed, dedicated color, not a
  // name-guessed one — see PointsTab.jsx's comment on why Channel rows
  // skip `resolveWaypointType` entirely).
  channel: { bg: '#f0fdfa', color: '#0f766e', border: 'rgba(153,246,228,0.6)' },
};

// Types not listed above (printing_shop, cafe, restaurant, pharmacy,
// barber, laundry, fuel, security_post) never got a dedicated rule in
// legacy either — they fall through to this default, the same violet used
// throughout the panel's own chrome (matches the Figma spec's "PRINTING
// SHOP" badge exactly: #faf5ff / rgba(233,213,255,0.6) / #6d28d9).
const DEFAULT_BADGE = { bg: '#faf5ff', color: '#6d28d9', border: 'rgba(233,213,255,0.6)' };

export function badgeStyleFor(key) {
  const c = ADMIN_BADGE_COLORS[key] || DEFAULT_BADGE;
  return { background: c.bg, color: c.color, borderColor: c.border };
}
