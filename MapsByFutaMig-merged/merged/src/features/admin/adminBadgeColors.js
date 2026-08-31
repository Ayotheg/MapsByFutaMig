// Ported verbatim from legacy style.css ~1911–1959 (`.admin-item-badge.*`).
// Types not listed here (printing_shop, cafe, restaurant, pharmacy,
// barber, laundry, fuel, security_post) never got a dedicated rule in
// legacy either — they fall through to the plain default badge color
// (rgba(183,109,255,...), same "primary" shown below as the fallback).
// Same underlying inconsistency BRAND_GUIDELINES.md already flags for
// legend swatches vs. map-pin colors on this exact set of types — not a
// transcription gap here, a real pre-existing legacy one.
export const ADMIN_BADGE_COLORS = {
  seg: { bg: 'rgba(68,226,205,0.1)', color: 'var(--secondary)', border: 'rgba(68,226,205,0.22)' },
  road: { bg: 'rgba(68,226,205,0.1)', color: 'var(--secondary)', border: 'rgba(68,226,205,0.22)' },
  kml: { bg: 'rgba(255,185,95,0.1)', color: 'var(--tertiary)', border: 'rgba(255,185,95,0.22)' },

  lecture_hall: { bg: 'rgba(55,138,221,0.12)', color: '#378ADD', border: 'rgba(55,138,221,0.28)' },
  faculty: { bg: 'rgba(24,95,165,0.12)', color: '#85B7EB', border: 'rgba(24,95,165,0.28)' },
  laboratory: { bg: 'rgba(93,202,165,0.12)', color: '#5DCAA5', border: 'rgba(93,202,165,0.28)' },
  workshop: { bg: 'rgba(29,158,117,0.12)', color: '#1D9E75', border: 'rgba(29,158,117,0.28)' },
  library: { bg: 'rgba(159,225,203,0.12)', color: '#9FE1CB', border: 'rgba(159,225,203,0.28)' },

  senate: { bg: 'rgba(127,119,221,0.12)', color: '#7F77DD', border: 'rgba(127,119,221,0.28)' },
  admin: { bg: 'rgba(175,169,236,0.12)', color: '#AFA9EC', border: 'rgba(175,169,236,0.28)' },
  bursary: { bg: 'rgba(206,203,246,0.12)', color: '#AFA9EC', border: 'rgba(206,203,246,0.28)' },
  student_affairs: { bg: 'rgba(83,74,183,0.12)', color: '#AFA9EC', border: 'rgba(83,74,183,0.28)' },

  hostel: { bg: 'rgba(239,159,39,0.12)', color: '#EF9F27', border: 'rgba(239,159,39,0.28)' },
  staff_quarters: { bg: 'rgba(186,117,23,0.12)', color: '#FAC775', border: 'rgba(186,117,23,0.28)' },

  shopping: { bg: 'rgba(216,90,48,0.12)', color: '#F0997B', border: 'rgba(216,90,48,0.28)' },
  kiosk: { bg: 'rgba(240,153,123,0.12)', color: '#F0997B', border: 'rgba(240,153,123,0.28)' },
  bank: { bg: 'rgba(153,60,29,0.12)', color: '#F0997B', border: 'rgba(153,60,29,0.28)' },

  sports: { bg: 'rgba(212,83,126,0.12)', color: '#D4537E', border: 'rgba(212,83,126,0.28)' },
  hall: { bg: 'rgba(237,147,177,0.12)', color: '#ED93B1', border: 'rgba(237,147,177,0.28)' },
  clinic: { bg: 'rgba(244,192,209,0.12)', color: '#ED93B1', border: 'rgba(244,192,209,0.28)' },
  auditorium: { bg: 'rgba(153,53,86,0.12)', color: '#ED93B1', border: 'rgba(153,53,86,0.28)' },
  toilet: { bg: 'rgba(56,189,248,0.12)', color: '#38BDF8', border: 'rgba(56,189,248,0.28)' },

  garage: { bg: 'rgba(136,135,128,0.12)', color: '#B4B2A9', border: 'rgba(136,135,128,0.28)' },
  bus_stop: { bg: 'rgba(95,94,90,0.12)', color: '#B4B2A9', border: 'rgba(95,94,90,0.28)' },
  utility: { bg: 'rgba(180,178,169,0.12)', color: '#B4B2A9', border: 'rgba(180,178,169,0.28)' },

  mosque: { bg: 'rgba(250,199,117,0.12)', color: '#FAC775', border: 'rgba(250,199,117,0.28)' },
  chapel: { bg: 'rgba(239,159,39,0.12)', color: '#FAC775', border: 'rgba(239,159,39,0.28)' },

  gate: { bg: 'rgba(226,75,74,0.12)', color: '#E24B4A', border: 'rgba(226,75,74,0.28)' },
  entrance: { bg: 'rgba(226,75,74,0.12)', color: '#E24B4A', border: 'rgba(226,75,74,0.28)' },
  hazard: { bg: 'rgba(226,75,74,0.12)', color: '#E24B4A', border: 'rgba(226,75,74,0.28)' },

  landmark: { bg: 'rgba(175,169,236,0.12)', color: '#AFA9EC', border: 'rgba(175,169,236,0.28)' },
  poi: { bg: 'rgba(93,202,165,0.12)', color: '#5DCAA5', border: 'rgba(93,202,165,0.28)' },
  junction: { bg: 'rgba(136,135,128,0.12)', color: '#B4B2A9', border: 'rgba(136,135,128,0.28)' },
};

const DEFAULT_BADGE = { bg: 'rgba(183,109,255,0.1)', color: 'var(--primary)', border: 'rgba(183,109,255,0.2)' };

export function badgeStyleFor(key) {
  const c = ADMIN_BADGE_COLORS[key] || DEFAULT_BADGE;
  return { background: c.bg, color: c.color, borderColor: c.border };
}
