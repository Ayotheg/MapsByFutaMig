/**
 * geoUtils.js — distance + path-simplification helpers.
 *
 * Ported from legacy `app.js` ~1597–1694 (`haversine`, `projectLatLng`,
 * `unprojectXY`, `getSqSegDist`, `simplifyDP`, `simplifyPath`). These are
 * used by `processImportPipeline` (Slice 5) to filter/smooth an imported
 * GPS track before it's saved as a segment.
 *
 * NOTE for whoever builds Slice 9 (GPS & Navigation): MIGRATION_PLAN.md
 * lists "path simplification (Douglas-Peucker)" under Slice 9 too — legacy
 * only has ONE copy of this code, reused by both the import pipeline and
 * live route recording. Slice 5 needs it first (recording doesn't exist
 * yet), so it lives here. Per CLAUDE.md's "no premature shared
 * components" rule this stays feature-local for now; if Slice 9 needs the
 * identical functions, that's the second real usage — promote this file
 * to `src/lib/` at that point rather than duplicating it.
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
