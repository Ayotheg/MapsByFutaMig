import { haversine } from '../../lib/geoUtils.js';

// Route geometry for the rotating nav map and the "Nearby places" list.
// `coords` is the route polyline as [lat, lng] pairs (fetchRoute's shape).

/** Cumulative distance (m) at each vertex — compute once per route. */
export function cumulativeDistances(coords) {
  const cum = [0];
  for (let i = 1; i < coords.length; i++) {
    cum.push(cum[i - 1] + haversine(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]));
  }
  return cum;
}

/** [lat, lng] at `d` metres along the route (clamped to its ends). */
export function pointAlong(coords, cum, d) {
  if (d <= 0) return coords[0];
  const total = cum[cum.length - 1];
  if (d >= total) return coords[coords.length - 1];
  let i = 1;
  while (cum[i] < d) i++;
  const span = cum[i] - cum[i - 1] || 1;
  const t = (d - cum[i - 1]) / span;
  return [
    coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * t,
    coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * t,
  ];
}

/** Compass bearing (0 = north, clockwise) from a to b. */
export function bearingBetween(a, b) {
  const toRad = Math.PI / 180;
  const y = Math.sin((b[1] - a[1]) * toRad) * Math.cos(b[0] * toRad);
  const x =
    Math.cos(a[0] * toRad) * Math.sin(b[0] * toRad) -
    Math.sin(a[0] * toRad) * Math.cos(b[0] * toRad) * Math.cos((b[1] - a[1]) * toRad);
  return ((Math.atan2(y, x) / toRad) + 360) % 360;
}

/**
 * Direction of the road just ahead of `along`. Looks a short way forward
 * rather than at the current vertex so GPS jitter and tiny kinks in the
 * route line don't make the map twitch.
 */
export function headingAhead(coords, cum, along, lookAhead = 30) {
  const total = cum[cum.length - 1];
  const from = Math.min(along, Math.max(0, total - lookAhead));
  return bearingBetween(pointAlong(coords, cum, from), pointAlong(coords, cum, from + lookAhead));
}

/**
 * Places within `maxOffset` metres of the route between `from` and `to`
 * metres along it, nearest first. `side` is relative to the direction of
 * travel, so the list can say "on your left/right" instead of compass
 * points.
 */
export function placesAlong(coords, cum, from, to, places, { maxOffset = 35, limit = 12 } = {}) {
  if (to <= from || coords.length < 2) return [];

  let first = 1;
  while (first < coords.length - 1 && cum[first] < from) first++;
  let last = first;
  while (last < coords.length - 1 && cum[last] < to) last++;

  // Flat-earth metres around the stretch's start — fine at this scale.
  const origin = coords[first - 1];
  const cosLat = Math.cos((origin[0] * Math.PI) / 180);
  const toXY = (lat, lng) => ({ x: (lng - origin[1]) * 111320 * cosLat, y: (lat - origin[0]) * 110540 });

  const segs = [];
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (let i = first; i <= last; i++) {
    const a = coords[i - 1];
    const b = coords[i];
    segs.push({ a: toXY(a[0], a[1]), b: toXY(b[0], b[1]), start: cum[i - 1], len: cum[i] - cum[i - 1] });
    minLat = Math.min(minLat, a[0], b[0]);
    maxLat = Math.max(maxLat, a[0], b[0]);
    minLng = Math.min(minLng, a[1], b[1]);
    maxLng = Math.max(maxLng, a[1], b[1]);
  }
  const padLat = maxOffset / 110540;
  const padLng = maxOffset / (111320 * cosLat);

  const found = [];
  for (const place of places) {
    const lat = Number(place.lat);
    const lng = Number(place.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (lat < minLat - padLat || lat > maxLat + padLat || lng < minLng - padLng || lng > maxLng + padLng) continue;

    const p = toXY(lat, lng);
    let best = null;
    for (const s of segs) {
      const dx = s.b.x - s.a.x;
      const dy = s.b.y - s.a.y;
      const den = dx * dx + dy * dy;
      // Repeated route points give a zero-length segment with no direction
      // (its cross product is always 0, i.e. a wrong "right").
      if (den === 0) continue;
      const t = Math.max(0, Math.min(1, ((p.x - s.a.x) * dx + (p.y - s.a.y) * dy) / den));
      const offset = Math.hypot(p.x - (s.a.x + dx * t), p.y - (s.a.y + dy * t));
      const along = s.start + s.len * t;
      if (offset > maxOffset || along < from || along > to) continue;
      if (!best || offset < best.offset) {
        // Positive cross product = the place is to the left of travel.
        const cross = dx * (p.y - s.a.y) - dy * (p.x - s.a.x);
        best = { offset, along, side: cross > 0 ? 'left' : 'right' };
      }
    }
    if (best) found.push({ place, ahead: best.along - from, side: best.side });
  }

  found.sort((x, y) => x.ahead - y.ahead);
  return found.slice(0, limit);
}

/**
 * A named place to "walk towards" before the user's direction is known:
 * the nearest one close to the route between `from` and `to` (the first
 * turn), skipping any under `minAhead` — one right beside the user doesn't
 * point the way. Places matching `prefer` win over nearer ones that don't.
 * Returns { place, along } (metres along the route) or null.
 */
export function startLandmark(coords, cum, from, to, places, { minAhead = 20, maxAhead = 150, prefer = () => false } = {}) {
  const end = Math.min(to, from + maxAhead, cum[cum.length - 1]);
  const found = placesAlong(coords, cum, from, end, places, { maxOffset: 30, limit: Infinity }).filter(
    (f) => f.ahead >= minAhead && f.place.name
  );
  const pick = found.find((f) => prefer(f.place)) ?? found[0];
  return pick ? { place: pick.place, along: from + pick.ahead } : null;
}
