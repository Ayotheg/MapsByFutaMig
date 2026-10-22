import { stepInstruction } from './turnHelpers';
import { pickShortcuts, stitchRoute } from './shortcutRoute';

/**
 * Ported from legacy `app.js` ~4499–4540 (`OSRM_PROFILES`, `fetchRoute`).
 * Free public OSRM demo server, no API key, matching legacy exactly
 * (the header comment's "ORS fallback" was aspirational — legacy never
 * actually implements an ORS fallback path, only OSRM is called).
 */
const OSRM_PROFILES = {
  'foot-walking': 'foot',
  'cycling-regular': 'bike',
  'driving-car': 'car',
};

/**
 * `paths` are approved walking paths (shortcutRoute.js `walkablePaths`).
 * On foot, the best few near the OSRM route are tried as detours and the
 * shortest result wins; a detour whose requests fail is just skipped.
 */
export async function fetchRoute(fromLat, fromLng, toLat, toLng, mode, paths = []) {
  const profile = OSRM_PROFILES[mode] || 'foot';
  const base = await requestRoute(fromLat, fromLng, toLat, toLng, profile);
  if (profile !== 'foot' || !paths.length) return base;

  const shortcuts = pickShortcuts(base, paths);
  if (!shortcuts.length) return base;
  const secondsPerMetre = base.distance ? base.duration / base.distance : 1 / 1.4;
  const stitched = await Promise.allSettled(
    shortcuts.map(async (s) => {
      const [entry, exit] = [s.coords[0], s.coords[s.coords.length - 1]];
      const [legA, legB] = await Promise.all([
        requestRoute(fromLat, fromLng, entry[0], entry[1], profile),
        requestRoute(exit[0], exit[1], toLat, toLng, profile),
      ]);
      return stitchRoute(legA, s, legB, secondsPerMetre);
    })
  );
  return stitched
    .filter((r) => r.status === 'fulfilled')
    .reduce((best, { value }) => (value.distance < best.distance ? value : best), base);
}

async function requestRoute(fromLat, fromLng, toLat, toLng, profile) {
  const url =
    `https://router.project-osrm.org/route/v1/${profile}/` +
    `${fromLng},${fromLat};${toLng},${toLat}` +
    `?overview=full&geometries=geojson&steps=true&annotations=false&alternatives=true`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.code !== 'Ok' || !data.routes || !data.routes.length) {
    throw new Error('No route found');
  }

  const route = data.routes.reduce((shortest, candidate) =>
    candidate.distance < shortest.distance ? candidate : shortest
  );
  const coords = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  const steps = route.legs.flatMap((leg) => leg.steps).map((s) => ({
    instruction: stepInstruction(s),
    type: s.maneuver?.type || 'straight',
    modifier: s.maneuver?.modifier || '',
    distance: s.distance,
    duration: s.duration,
    location: s.maneuver?.location ? [s.maneuver.location[1], s.maneuver.location[0]] : null,
    name: s.name || '',
    ref: s.ref || '',
  }));

  return {
    coords,
    distance: route.distance, // metres
    duration: route.duration, // seconds
    steps,
  };
}
