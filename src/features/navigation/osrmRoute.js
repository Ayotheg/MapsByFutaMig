import { stepInstruction } from './turnHelpers';
import { pickShortcuts, stitchRoute } from './shortcutRoute';

// FOSSGIS's public OSRM servers (the ones openstreetmap.org's directions
// use), one per profile. Not OSRM's demo server: it only runs the car
// profile whatever the URL says, so walking routes kept to main roads and
// never used footpaths. Bike is for bicycles/okada. Car (keke, cab,
// shuttle, car) keeps to roads cars may use, one-ways included. Free, no key, fair use
// (https://routing.openstreetmap.de).
const OSRM_SERVERS = {
  'foot-walking': 'https://routing.openstreetmap.de/routed-foot',
  'cycling-regular': 'https://routing.openstreetmap.de/routed-bike',
  'driving-car': 'https://routing.openstreetmap.de/routed-car',
};

/**
 * `paths` are approved walking paths (shortcutRoute.js `walkablePaths`).
 * On foot, the best few near the OSRM route are tried as detours and the
 * shortest result wins; a detour whose requests fail is just skipped.
 */
export async function fetchRoute(fromLat, fromLng, toLat, toLng, mode, paths = []) {
  const server = OSRM_SERVERS[mode] || OSRM_SERVERS['foot-walking'];
  const base = await requestRoute(fromLat, fromLng, toLat, toLng, server);
  if (server !== OSRM_SERVERS['foot-walking'] || !paths.length) return base;

  const shortcuts = pickShortcuts(base, paths);
  if (!shortcuts.length) return base;
  const secondsPerMetre = base.distance ? base.duration / base.distance : 1 / 1.4;
  const stitched = await Promise.allSettled(
    shortcuts.map(async (s) => {
      const [entry, exit] = [s.coords[0], s.coords[s.coords.length - 1]];
      const [legA, legB] = await Promise.all([
        requestRoute(fromLat, fromLng, entry[0], entry[1], server),
        requestRoute(exit[0], exit[1], toLat, toLng, server),
      ]);
      return stitchRoute(legA, s, legB, secondsPerMetre);
    })
  );
  // A null stitch: OSRM's legs don't reach the path's ends.
  return stitched
    .filter((r) => r.status === 'fulfilled' && r.value)
    .reduce((best, { value }) => (value.distance < best.distance ? value : best), base);
}

async function requestRoute(fromLat, fromLng, toLat, toLng, server) {
  // These servers take 'driving' in the path whatever their profile.
  const url =
    `${server}/route/v1/driving/` +
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
