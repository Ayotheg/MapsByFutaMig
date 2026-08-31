/**
 * Pure helpers for Slice 6 (OSM annotations + dedup).
 * Ported from legacy `app.js` ~2879–3015 (`_OSM_BADGE`/`_osmBadge`,
 * `_metersApart`, `_dedupNormName`, `_findDuplicate`).
 *
 * Deviation: `findDuplicate` takes an `index` array parameter instead of
 * reading the global `window.FUTA_SEARCH.index` — that index doesn't exist
 * in this port until Slice 7 (Search), and Slice 6 explicitly depends only
 * on Slices 2/3, not 7. The caller (`useOSMAnnotations`) builds an
 * equivalent `{ id, lat, lng, name, source }[]` array from whatever is
 * already loaded (waypoints, KML annotations) instead. Same shape as a
 * `FUTA_SEARCH` entry, same matching rules — just sourced differently.
 */

export const DEDUP_RADIUS_M = 90; // metres — see legacy's comment (app.js ~2966–2971):
// GPS-annotated waypoints are taken from outside a building, OSM stores the
// centroid; documented real-world offsets run up to ~80m, so 90m gives margin.

const OSM_BADGE = {
  university: 'University', college: 'College', school: 'School',
  library: 'Library', hospital: 'Hospital', clinic: 'Clinic',
  pharmacy: 'Pharmacy', bank: 'Bank', atm: 'ATM',
  restaurant: 'Restaurant', cafe: 'Café', fast_food: 'Fast Food',
  fuel: 'Fuel Station', parking: 'Parking',
  place_of_worship: 'Place of Worship', stadium: 'Stadium',
  sports_centre: 'Sports Centre', dormitory: 'Dormitory',
  hall_of_residence: 'Hall of Residence', office: 'Office',
  administrative: 'Administrative', yes: 'Building',
};

export function osmBadge(tags) {
  const v = tags.amenity || tags.building || tags.office || tags.leisure || tags.shop || '';
  return OSM_BADGE[v] || (v ? v.replace(/_/g, ' ') : 'Place');
}

export function metersApart(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Strip everything except lowercase alphanumerics so "Main Library" === "mainlibrary"
export function dedupNormName(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Returns the first entry in `index` that matches the given OSM item, or
 * null if no duplicate is found. `index` entries: { id, lat, lng, name, source }.
 */
export function findDuplicate(osmLat, osmLng, osmName, index) {
  const osmNorm = dedupNormName(osmName);
  if (!osmNorm) return null;

  for (const e of index) {
    if (e.lat == null || e.lng == null) continue;
    const dist = metersApart(osmLat, osmLng, e.lat, e.lng);
    if (dist > DEDUP_RADIUS_M) continue; // too far away — not the same building

    const eNorm = dedupNormName(e.name);

    // Accept as duplicate if names match exactly, or one contains the other
    // (handles abbreviations like "CST" vs "College of Science and Technology")
    const nameMatch = osmNorm === eNorm || osmNorm.includes(eNorm) || eNorm.includes(osmNorm);
    if (nameMatch) return e;

    // Also accept purely proximity-based match when names share a meaningful
    // prefix (≥5 chars) — catches minor spelling variants like "Cafetaria" vs "Cafeteria"
    const prefixLen = Math.min(osmNorm.length, eNorm.length, 8);
    if (prefixLen >= 5 && osmNorm.slice(0, prefixLen) === eNorm.slice(0, prefixLen)) return e;
  }
  return null;
}
