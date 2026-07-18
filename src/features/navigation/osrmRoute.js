import { stepInstruction } from './turnHelpers';

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

export async function fetchRoute(fromLat, fromLng, toLat, toLng, mode) {
  const profile = OSRM_PROFILES[mode] || 'foot';
  const url =
    `https://router.project-osrm.org/route/v1/${profile}/` +
    `${fromLng},${fromLat};${toLng},${toLat}` +
    `?overview=full&geometries=geojson&steps=true&annotations=false`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.code !== 'Ok' || !data.routes || !data.routes.length) {
    throw new Error('No route found');
  }

  const route = data.routes[0];
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
