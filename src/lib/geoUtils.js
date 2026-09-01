/**
 * geoUtils.js — distance + path-simplification helpers.
 *
 * Ported from legacy `app.js` ~1597–1694 (`haversine`, `projectLatLng`,
 * `unprojectXY`, `getSqSegDist`, `simplifyDP`, `simplifyPath`). Originally
 * landed feature-local under `src/features/kml/` (Slice 5), used by
 * `processImportPipeline` to filter/smooth an imported GPS track before
 * it's saved as a segment.
 *
 * **Promoted to `src/lib/` in Slice 9** — this is the second real usage
 * the Slice 5 header comment predicted: Slice 9's `useGpsTracking.js`
 * needs `haversine` for its own trail-point distance check + the nav
 * module's HUD/arrival-distance math (legacy actually keeps a *third*,
 * near-identical local copy of `haversine` — named `hav` — inside its
 * IIFE-scoped Navigation module, app.js ~4484–4492; this port
 * consolidates all three call sites onto the one function here rather
 * than reproducing legacy's own internal duplication, which is a pure
 * implementation detail, not a behavior change — same formula, same
 * output). `simplifyPath`/`simplifyDP` stay here too even though live
 * navigation doesn't call them (no track-recording/import step in the
 * nav flow) — Slice 5's import pipeline is still the only real caller of
 * those two, `haversine` is what's actually shared.
 */

const CAMPUS_CENTER = { lat: 7.298, lng: 5.138 };

export function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Returns progress and remaining distance relative to a lat/lng polyline. */
export function routePosition(coords, lat, lng) {
  if (!coords || coords.length < 2) return { progress: 0, distanceRemaining: 0, distanceTotal: 0 };

  const cosLat = Math.cos((lat * Math.PI) / 180);
  const toMeters = (point) => ({
    x: (point[1] - lng) * 111320 * cosLat,
    y: (point[0] - lat) * 110540,
  });
  const segmentLengths = [];
  let distanceTotal = 0;

  for (let i = 1; i < coords.length; i++) {
    const length = haversine(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
    segmentLengths.push(length);
    distanceTotal += length;
  }

  let distanceBefore = 0;
  let closestDistance = Infinity;
  let distanceAtClosest = 0;

  for (let i = 1; i < coords.length; i++) {
    const start = toMeters(coords[i - 1]);
    const end = toMeters(coords[i]);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const denominator = dx * dx + dy * dy;
    const projection = denominator === 0
      ? 0
      : Math.max(0, Math.min(1, -(start.x * dx + start.y * dy) / denominator));
    const closestX = start.x + projection * dx;
    const closestY = start.y + projection * dy;
    const distance = Math.hypot(closestX, closestY);

    if (distance < closestDistance) {
      closestDistance = distance;
      distanceAtClosest = distanceBefore + segmentLengths[i - 1] * projection;
    }
    distanceBefore += segmentLengths[i - 1];
  }

  return {
    progress: distanceTotal ? distanceAtClosest / distanceTotal : 0,
    distanceRemaining: Math.max(0, distanceTotal - distanceAtClosest),
    distanceTotal,
    // Perpendicular distance (metres) from (lat,lng) to the nearest point
    // ON the route polyline — i.e. how far off-course the user currently
    // is, not how far along the route they've travelled. `closestDistance`
    // is already computed above from the same meter-projected coordinates
    // used for `distanceAtClosest`, just not previously returned.
    offRouteMeters: closestDistance === Infinity ? 0 : closestDistance,
  };
}

function projectLatLng(lat, lng) {
  return {
    x: (lng - CAMPUS_CENTER.lng) * 110420,
    y: (lat - CAMPUS_CENTER.lat) * 111320,
  };
}

function unprojectXY(x, y) {
  return {
    lat: y / 111320 + CAMPUS_CENTER.lat,
    lng: x / 110420 + CAMPUS_CENTER.lng,
  };
}

function getSqSegDist(p, p1, p2) {
  let x = p1.x;
  let y = p1.y;
  let dx = p2.x - x;
  let dy = p2.y - y;

  if (dx !== 0 || dy !== 0) {
    const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = p2.x;
      y = p2.y;
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }

  dx = p.x - x;
  dy = p.y - y;
  return dx * dx + dy * dy;
}

function simplifyDP(points, sqTolerance) {
  const len = points.length;
  if (len <= 2) return points;

  const markers = new Uint8Array(len);
  markers[0] = markers[len - 1] = 1;

  const stack = [0, len - 1];

  while (stack.length > 0) {
    const last = stack.pop();
    const first = stack.pop();

    let maxSqDist = 0;
    let index = 0;

    for (let i = first + 1; i < last; i++) {
      const sqDist = getSqSegDist(points[i], points[first], points[last]);
      if (sqDist > maxSqDist) {
        index = i;
        maxSqDist = sqDist;
      }
    }

    if (maxSqDist > sqTolerance) {
      markers[index] = 1;
      stack.push(first, index, index, last);
    }
  }

  const result = [];
  for (let i = 0; i < len; i++) {
    if (markers[i]) result.push(points[i]);
  }
  return result;
}

/** Simplifies a GPS track ({lat,lng,accuracy,speed,timestamp}[]) to within
 * `toleranceMeters` using Douglas-Peucker, same as legacy `simplifyPath`. */
export function simplifyPath(coords, toleranceMeters) {
  if (coords.length <= 2) return coords;
  const projected = coords.map((c) => projectLatLng(c.lat, c.lng));
  const simplifiedProj = simplifyDP(projected, toleranceMeters * toleranceMeters);

  return simplifiedProj.map((proj, idx) => {
    const unproj = unprojectXY(proj.x, proj.y);
    const orig =
      coords.find(
        (c) => Math.abs(c.lat - unproj.lat) < 0.0001 && Math.abs(c.lng - unproj.lng) < 0.0001
      ) ||
      coords[idx] ||
      {};
    return {
      lat: unproj.lat,
      lng: unproj.lng,
      accuracy: orig.accuracy || 5,
      speed: orig.speed || 0,
      timestamp: orig.timestamp || Date.now(),
    };
  });
}