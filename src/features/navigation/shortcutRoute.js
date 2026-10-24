import { haversine, routePosition, simplifyPath } from '../../lib/geoUtils.js';
import { bearingBetween, cumulativeDistances } from './routeAhead.js';
import { stepInstruction, turnAngle } from './turnHelpers.js';

// Approved walking paths (admin-recorded segments for now) that OSRM's
// OpenStreetMap data doesn't know about. fetchRoute tries routing through
// the most promising ones and keeps whichever route is shortest.

// Roads are already in OSM and indoor routes can't be joined to the street
// network, so only these two categories are routed through.
const ROUTABLE_CATEGORIES = new Set(['footpath', 'shortcut']);

export const MAX_ENTRY_M = 150; // how far a path's end may be from the route
export const MIN_SAVING_M = 50; // same rule as learning one (shortcutDetect.js)
export const MAX_SHORTCUTS = 2; // each one costs two more OSRM requests
export const ON_PATH_M = 25;
// OSRM snaps each leg to the nearest road; if that's further than this
// from the path's end, the "join" would be a line across whatever's in
// between, so the shortcut isn't used.
export const MAX_JOIN_GAP_M = 25;

const DEG_PER_M = 1 / 111000;
// Walked GPS lines wobble; smooth them before looking for turns, and only
// announce a bend sharp enough to notice.
const PATH_SIMPLIFY_M = 6;
const TURN_MIN_DEG = 35;

/** Segments → routable paths: [lat, lng] coords, length and bounding box. */
export function walkablePaths(segments) {
  const paths = [];
  for (const seg of segments || []) {
    if (!ROUTABLE_CATEGORIES.has(seg.category)) continue;
    const coords = (seg.points || [])
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
      .map((p) => [p.lat, p.lng]);
    if (coords.length < 2) continue;
    const cum = cumulativeDistances(coords);
    const lats = coords.map((c) => c[0]);
    const lngs = coords.map((c) => c[1]);
    paths.push({
      id: seg.id,
      name: seg.name || '',
      coords,
      length: cum[cum.length - 1],
      bbox: [Math.min(...lats), Math.min(...lngs), Math.max(...lats), Math.max(...lngs)],
    });
  }
  return paths;
}

function placeOnRoute(coords, [lat, lng]) {
  const p = routePosition(coords, lat, lng);
  return { along: p.distanceTotal - p.distanceRemaining, off: p.offRouteMeters };
}

/**
 * Paths worth trying for `route`: both ends within `maxEntry` of it, and
 * walking to the path, along it and back is estimated to beat the stretch
 * of route it skips by at least `minSaving`. Coords come back oriented in
 * the direction of travel, best saving first.
 */
export function pickShortcuts(route, paths, { maxEntry = MAX_ENTRY_M, minSaving = MIN_SAVING_M, limit = MAX_SHORTCUTS } = {}) {
  const picks = [];
  for (const path of paths) {
    const start = placeOnRoute(route.coords, path.coords[0]);
    const end = placeOnRoute(route.coords, path.coords[path.coords.length - 1]);
    if (start.off > maxEntry || end.off > maxEntry) continue;
    const forward = start.along <= end.along;
    const [entry, exit] = forward ? [start, end] : [end, start];
    const saving = exit.along - entry.along - (entry.off + path.length + exit.off);
    if (saving < minSaving) continue;
    picks.push({
      id: path.id,
      name: path.name,
      length: path.length,
      coords: forward ? path.coords : [...path.coords].reverse(),
      saving,
    });
  }
  return picks.sort((a, b) => b.saving - a.saving).slice(0, limit);
}

// Same modifier words OSRM uses, so stepInstruction/turnIcon treat a
// shortcut's turns like any other.
function turnModifier(angle) {
  const a = Math.abs(angle);
  if (a < 20) return 'straight';
  const side = angle > 0 ? 'right' : 'left';
  if (a < 60) return `slight ${side}`;
  if (a < 140) return side;
  return `sharp ${side}`;
}

function turnStep(location, modifier, distance, secondsPerMetre, name = '') {
  const type = modifier === 'straight' ? 'continue' : 'turn';
  return {
    instruction: stepInstruction({ maneuver: { type, modifier }, name }),
    type,
    modifier,
    distance,
    duration: distance * secondsPerMetre,
    location,
    name,
    ref: '',
  };
}

// Bearing of a line's first / last stretch, skipping repeated points.
function firstBearing(coords) {
  for (let i = 1; i < coords.length; i++) {
    if (coords[i][0] !== coords[0][0] || coords[i][1] !== coords[0][1]) return bearingBetween(coords[0], coords[i]);
  }
  return null;
}
function lastBearing(coords) {
  const end = coords[coords.length - 1];
  for (let i = coords.length - 2; i >= 0; i--) {
    if (coords[i][0] !== end[0] || coords[i][1] !== end[1]) return bearingBetween(coords[i], end);
  }
  return null;
}

/**
 * One route out of: OSRM to the path's start, the path, OSRM from its end,
 * or null when OSRM's legs end too far from the path (MAX_JOIN_GAP_M).
 * Turns onto, along and off the path are worked out from its shape, so
 * the HUD says "Turn right" there just as it does on OSRM's own roads.
 * The path's walking time uses the base route's pace (`secondsPerMetre`).
 */
export function stitchRoute(legA, shortcut, legB, secondsPerMetre) {
  const entry = shortcut.coords[0];
  const exit = shortcut.coords[shortcut.coords.length - 1];
  const aEnd = legA.coords[legA.coords.length - 1];
  const bStart = legB.coords[0];
  const gapIn = haversine(aEnd[0], aEnd[1], entry[0], entry[1]);
  const gapOut = haversine(exit[0], exit[1], bStart[0], bStart[1]);
  if (gapIn > MAX_JOIN_GAP_M || gapOut > MAX_JOIN_GAP_M) return null;
  const joinGaps = gapIn + gapOut;
  const pts =simplifyPath(shortcut.coords.map(([lat, lng]) => ({ lat, lng })), PATH_SIMPLIFY_M).map((p) => [p.lat, p.lng]);
  const cum = cumulativeDistances(pts);
  const pathLength = cum[cum.length - 1];

  // Turn points along the path: the entry (if leaving the road at an
  // angle) and every bend.
  const turns = [];
  let heading = lastBearing(legA.coords);
  for (let i = 0; i < pts.length - 1; i++) {
    const next = bearingBetween(pts[i], pts[i + 1]);
    if (heading != null) {
      const angle = turnAngle(heading, next);
      if (Math.abs(angle) >= (i === 0 ? 20 : TURN_MIN_DEG)) turns.push({ i, modifier: turnModifier(angle) });
    }
    heading = next;
  }
  const pathSteps = turns.map(({ i, modifier }, k) =>
    turnStep(pts[i], modifier, (k + 1 < turns.length ? cum[turns[k + 1].i] : pathLength) - cum[i], secondsPerMetre)
  );

  // Leaving the path: legB's "depart" would announce a fresh start
  // mid-trip, so it becomes the turn back onto the road.
  const [first, ...rest] = legB.steps;
  const exitBearing = firstBearing(legB.coords);
  const rejoin =
    first?.type === 'depart'
      ? [
          turnStep(
            pts[pts.length - 1],
            exitBearing == null ? 'straight' : turnModifier(turnAngle(heading, exitBearing)),
            first.distance ?? 0,
            secondsPerMetre,
            first.name || ''
          ),
          ...rest,
        ]
      : legB.steps;

  const pathDuration = (pathLength + joinGaps) * secondsPerMetre;
  return {
    // Which path this route goes through (walkablePaths id).
    via: shortcut.id,
    coords: [...legA.coords, ...shortcut.coords, ...legB.coords],
    distance: legA.distance + pathLength + joinGaps + legB.distance,
    duration: legA.duration + pathDuration + legB.duration,
    steps: [...legA.steps.filter((s) => s.type !== 'arrive'), ...pathSteps, ...rejoin],
  };
}

/**
 * True when (lat, lng) is within `tolerance` metres of a path that leads
 * towards `dest` (one of its ends is closer to the destination than the
 * user is) — someone taking a shortcut they know, not someone heading the
 * wrong way along a footpath.
 */
export function isOnPathTowards(paths, lat, lng, dest, tolerance = ON_PATH_M) {
  const margin = tolerance * DEG_PER_M;
  const userToDest = haversine(lat, lng, dest.lat, dest.lng);
  return (paths || []).some(({ bbox: [minLat, minLng, maxLat, maxLng], coords }) => {
    if (lat < minLat - margin || lat > maxLat + margin || lng < minLng - margin || lng > maxLng + margin) return false;
    if (routePosition(coords, lat, lng).offRouteMeters > tolerance) return false;
    const a = coords[0];
    const b = coords[coords.length - 1];
    return Math.min(haversine(a[0], a[1], dest.lat, dest.lng), haversine(b[0], b[1], dest.lat, dest.lng)) < userToDest;
  });
}
