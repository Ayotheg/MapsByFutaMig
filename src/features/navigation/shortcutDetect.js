import { haversine, routePosition, simplifyPath } from '../../lib/geoUtils.js';
import { cumulativeDistances, pointAlong } from './routeAhead.js';

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
export const MAX_GAP_WALKING_M = 80;
export const MAX_GAP_VEHICLE_M = 200; // the server rejects anything larger
export const WALKING_MAX_MPS = 2.5; // faster than this is a ride, not a walk
export const PRIVACY_TRIM_M = 30; // never share where a trip started or ended
const MIN_POINT_SPACING_M = 5;
const SMOOTH_M = 8; // GPS wobble ignored when measuring a detour's length
const ON_ROAD_M = 10; // this close to the route counts as on it
export const MAX_POINTS = 300;

const MAX_TRACE_POINTS = 3000;

/**
 * Records fixes for one trip: keeps a point every few metres, and only
 * fixes accurate enough to trace a path (the same limit navigation uses).
 * `points` lets a trip restored after a reload carry on its trace.
 * `add` returns true when it kept the point.
 */
export function createTripTrace(points = [], maxAccuracy = 35) {
  return {
    points,
    add({ lat, lng, accuracy, t }) {
      if (typeof accuracy === 'number' && accuracy > maxAccuracy) return false;
      if (points.length >= MAX_TRACE_POINTS) return false;
      const last = points[points.length - 1];
      if (last && haversine(last.lat, last.lng, lat, lng) < MIN_POINT_SPACING_M) return false;
      points.push({ lat, lng, t });
      return true;
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

// GPS wobble makes a raw trace zig-zag and look longer than it was:
// average each point with its neighbours, then drop the leftover kinks.
// Only used to measure length; the shared path keeps the real fixes.
function smoothed(points, window = 2) {
  const avg = points.map((p, k) => {
    if (k === 0 || k === points.length - 1) return p;
    const near = points.slice(Math.max(0, k - window), k + window + 1);
    return { lat: near.reduce((s, q) => s + q.lat, 0) / near.length, lng: near.reduce((s, q) => s + q.lng, 0) / near.length };
  });
  return simplifyPath(avg, SMOOTH_M);
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
 *
 * Only detours that leave the route and come back to it count. Each
 * shared path starts and ends on the route itself, so the next person's
 * route can join it there. Not shared: a detour that never comes back
 * (it ends at the destination, which may be someone's room, and no route
 * can join its end), and one starting or ending within PRIVACY_TRIM_M of
 * where the trip started or arrived.
 *
 * `stats`, if given, is filled with why each off-route stretch was or
 * wasn't kept — counts only, no locations — for diagnosing field tests.
 */
export function findShortcuts(route, points, { origin, stats = {} } = {}) {
  Object.assign(stats, { points: points.length, offRuns: 0, noRejoin: 0, nearStartOrEnd: 0, gaps: 0, notShorter: 0, bestSavingM: null });
  if (!route || route.length < 2 || points.length < 3) return [];
  const start = origin || points[0];
  const end = points[points.length - 1];
  const cum = cumulativeDistances(route);
  const onRoute = (along) => {
    const [lat, lng] = pointAlong(route, cum, along);
    return { lat, lng };
  };
  const nearStartOrEnd = (p) =>
    haversine(start.lat, start.lng, p.lat, p.lng) < PRIVACY_TRIM_M || haversine(end.lat, end.lng, p.lat, p.lng) < PRIVACY_TRIM_M;
  const placed = points.map((p) => {
    const r = routePosition(route, p.lat, p.lng);
    return { ...p, along: r.distanceTotal - r.distanceRemaining, off: r.offRouteMeters };
  });

  const found = [];
  let i = 0;
  while (i < placed.length) {
    if (placed[i].off <= OFF_ROUTE_M) {
      i++;
      continue;
    }
    // Off-route run, widened to where they were really on the road (within
    // ON_ROAD_M) before and after it — the 40 m "off route" line itself is
    // well into the detour.
    let entry = Math.max(0, i - 1);
    while (entry > 0 && placed[entry].off > ON_ROAD_M) entry--;
    let j = i;
    while (j < placed.length && placed[j].off > OFF_ROUTE_M) j++;
    stats.offRuns++;
    if (j >= placed.length) {
      stats.noRejoin++;
      break;
    }
    let exit = j;
    while (exit < placed.length - 1 && placed[exit].off > ON_ROAD_M) exit++;
    i = exit + 1;
    const stretch = placed.slice(entry, exit + 1);
    if (nearStartOrEnd(stretch[0]) || nearStartOrEnd(stretch[stretch.length - 1])) {
      stats.nearStartOrEnd++;
      continue;
    }

    // Each hop's allowed gap depends on how fast that hop was travelled.
    let gap = false;
    for (let k = 1; k < stretch.length; k++) {
      const d = haversine(stretch[k - 1].lat, stretch[k - 1].lng, stretch[k].lat, stretch[k].lng);
      const s = (stretch[k].t - stretch[k - 1].t) / 1000;
      const fast = s > 0 && d / s > WALKING_MAX_MPS;
      if (d > (fast ? MAX_GAP_VEHICLE_M : MAX_GAP_WALKING_M)) gap = true;
    }
    if (gap) {
      stats.gaps++;
      continue;
    }

    // From the route, along the detour, back onto the route.
    const path = [onRoute(placed[entry].along), ...stretch, onRoute(placed[exit].along)];
    const walked = pathLength(smoothed(path));
    const skipped = placed[exit].along - placed[entry].along;
    const saved = skipped - walked;
    stats.bestSavingM = Math.max(stats.bestSavingM ?? -Infinity, Math.round(saved));
    if (saved < MIN_SAVING_M) {
      stats.notShorter++;
      continue;
    }

    const seconds = (stretch[stretch.length - 1].t - stretch[0].t) / 1000;
    found.push({
      path: thin(path, MAX_POINTS).map((p) => [Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6))]),
      length: Math.round(walked),
      saved: Math.round(saved),
      byVehicle: seconds > 0 && walked / seconds > WALKING_MAX_MPS,
    });
  }
  return found;
}
