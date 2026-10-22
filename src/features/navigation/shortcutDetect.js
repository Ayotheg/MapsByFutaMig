import { haversine, routePosition } from '../../lib/geoUtils.js';

// Finds the stretches of a finished trip where the user left the planned
// route and still got there by a shorter way — on foot, or in any vehicle
// (a road a vehicle can use is almost always walkable). Those
// stretches are what the app shares (learnedShortcutsClient.js) so others
// get routed through them once enough people have taken the same way.

export const OFF_ROUTE_M = 40; // same threshold NavigationController reroutes at
// About 40 s of walking: worth taking, and well above GPS wobble. The same
// rule decides when a learned shortcut is used (shortcutRoute.js).
export const MIN_SAVING_M = 50;
// A bigger jump between fixes means we don't know where they went. A
// moving vehicle covers more ground between fixes, so it's allowed more.
export const MAX_GAP_WALKING_M = 50;
export const MAX_GAP_VEHICLE_M = 200; // the server rejects anything larger
export const WALKING_MAX_MPS = 2.5; // faster than this is a ride, not a walk
export const PRIVACY_TRIM_M = 30; // never share where a trip started or ended
const MIN_POINT_SPACING_M = 5;
export const MAX_POINTS = 300;

/**
 * Records walked fixes for one trip: keeps a point every few metres and
 * only fixes accurate enough to trace a path.
 */
export function createTripTrace(maxAccuracy = 25) {
  const points = [];
  return {
    points,
    add({ lat, lng, accuracy, t }) {
      if (typeof accuracy === 'number' && accuracy > maxAccuracy) return;
      const last = points[points.length - 1];
      if (last && haversine(last.lat, last.lng, lat, lng) < MIN_POINT_SPACING_M) return;
      points.push({ lat, lng, t });
    },
  };
}

/**
 * Did the trip actually walk `path` ([lat, lng]...)? True when at least
 * `minShare` of its points had a walked fix within `tolerance` metres.
 * Used to tell whether people routed through a learned shortcut can
 * really get through it.
 */
export function walkedPath(path, points, { tolerance = 25, minShare = 0.7 } = {}) {
  if (!path?.length || !points?.length) return false;
  let near = 0;
  for (const [lat, lng] of path) {
    if (points.some((p) => haversine(lat, lng, p.lat, p.lng) <= tolerance)) near++;
  }
  return near / path.length >= minShare;
}

// At most `max` points, spread evenly and keeping both ends.
function thin(points, max) {
  if (points.length <= max) return points;
  return Array.from({ length: max }, (_, i) => points[Math.round((i * (points.length - 1)) / (max - 1))]);
}

function pathLength(points) {
  let d = 0;
  for (let i = 1; i < points.length; i++) d += haversine(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
  return d;
}

/**
 * `route` is the [lat, lng] polyline the trip started with; `points` the
 * trace ({lat, lng, t}); `origin` ({lat, lng}) where the trip started —
 * defaults to the first trace point. Returns
 * [{ path: [[lat, lng]...], length, saved, byVehicle }].
 * A detour that never rejoins the route counts as ending at the
 * destination (the route's end), since the trip arrived. Nothing within
 * PRIVACY_TRIM_M of the start or of the arrival point is included.
 */
export function findShortcuts(route, points, { origin } = {}) {
  if (!route || route.length < 2 || points.length < 3) return [];
  const start = origin || points[0];
  const end = points[points.length - 1];
  const placed = points.map((p) => {
    const r = routePosition(route, p.lat, p.lng);
    return { ...p, along: r.distanceTotal - r.distanceRemaining, off: r.offRouteMeters, total: r.distanceTotal };
  });

  const found = [];
  let i = 0;
  while (i < placed.length) {
    if (placed[i].off <= OFF_ROUTE_M) {
      i++;
      continue;
    }
    // Off-route run: from the last on-route fix before it to the first one after.
    const entry = Math.max(0, i - 1);
    let j = i;
    while (j < placed.length && placed[j].off > OFF_ROUTE_M) j++;
    const rejoined = j < placed.length;
    const exit = rejoined ? j : placed.length - 1;
    i = j + 1;

    const stretch = placed.slice(entry, exit + 1);
    const exitAlong = rejoined ? placed[exit].along : placed[exit].total;
    const skipped = exitAlong - placed[entry].along;
    const walked = pathLength(stretch);
    if (skipped - walked < MIN_SAVING_M) continue;

    // Each hop's allowed gap depends on how fast that hop was travelled.
    let gap = false;
    for (let k = 1; k < stretch.length; k++) {
      const d = haversine(stretch[k - 1].lat, stretch[k - 1].lng, stretch[k].lat, stretch[k].lng);
      const s = (stretch[k].t - stretch[k - 1].t) / 1000;
      const fast = s > 0 && d / s > WALKING_MAX_MPS;
      if (d > (fast ? MAX_GAP_VEHICLE_M : MAX_GAP_WALKING_M)) gap = true;
    }
    if (gap) continue;
    const seconds = (stretch[stretch.length - 1].t - stretch[0].t) / 1000;

    // Trim from the two ends only: dropping points from the middle would
    // join what's left with a straight line.
    const nearEnds = (p) => haversine(start.lat, start.lng, p.lat, p.lng) < PRIVACY_TRIM_M || haversine(end.lat, end.lng, p.lat, p.lng) < PRIVACY_TRIM_M;
    let from = 0;
    let to = stretch.length;
    while (from < to && nearEnds(stretch[from])) from++;
    while (to > from && nearEnds(stretch[to - 1])) to--;
    const shared = stretch.slice(from, to);
    if (shared.length < 3) continue;
    found.push({
      path: thin(shared, MAX_POINTS).map((p) => [Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6))]),
      length: Math.round(pathLength(shared)),
      saved: Math.round(skipped - walked),
      byVehicle: seconds > 0 && walked / seconds > WALKING_MAX_MPS,
    });
  }
  return found;
}
