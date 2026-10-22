import { haversine, routePosition } from '../../lib/geoUtils.js';

// Finds the stretches of a finished trip where the user left the planned
// route and still got there by a shorter way. Those stretches are what the
// app shares (learnedShortcutsClient.js) so other students get routed
// through them once enough people have walked the same way.

export const OFF_ROUTE_M = 40; // same threshold NavigationController reroutes at
export const MIN_SAVING_M = 30;
export const MIN_SAVING_RATIO = 0.15; // walked at least 15% shorter than the route
export const MAX_GAP_M = 50; // a bigger jump between fixes means we don't know where they went
export const MAX_WALK_SPEED_MPS = 2.5; // faster than this was a ride, not a walk
export const PRIVACY_TRIM_M = 30; // never share where a trip started
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

function pathLength(points) {
  let d = 0;
  for (let i = 1; i < points.length; i++) d += haversine(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
  return d;
}

/**
 * `route` is the [lat, lng] polyline the trip started with; `points` the
 * trace ({lat, lng, t}). Returns [{ path: [[lat, lng]...], length, saved }].
 * A detour that never rejoins the route counts as ending at the
 * destination (the route's end), since the trip arrived.
 */
export function findShortcuts(route, points) {
  if (!route || route.length < 2 || points.length < 3) return [];
  const start = points[0];
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
    if (skipped - walked < MIN_SAVING_M || walked > skipped * (1 - MIN_SAVING_RATIO)) continue;

    let gap = false;
    for (let k = 1; k < stretch.length; k++) {
      if (haversine(stretch[k - 1].lat, stretch[k - 1].lng, stretch[k].lat, stretch[k].lng) > MAX_GAP_M) gap = true;
    }
    if (gap) continue;
    const seconds = (stretch[stretch.length - 1].t - stretch[0].t) / 1000;
    if (seconds > 0 && walked / seconds > MAX_WALK_SPEED_MPS) continue;

    const shared = stretch.filter((p) => haversine(start.lat, start.lng, p.lat, p.lng) >= PRIVACY_TRIM_M);
    if (shared.length < 2) continue;
    found.push({
      path: shared.slice(0, MAX_POINTS).map((p) => [Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6))]),
      length: Math.round(pathLength(shared)),
      saved: Math.round(skipped - walked),
    });
  }
  return found;
}
