import { useEffect, useState } from 'react';
import { subscribeGps, getLastFix } from '../navigation/gpsWatch';
import { haversine } from '../../lib/geoUtils';

// Ignore GPS jitter: only hand out a new position (and so re-rank the
// chip results) once the person has actually moved this far.
const MIN_MOVE_M = 10;
// A fix from the shared watch younger than this is good enough to rank
// by straight away when the panel opens.
const SEED_MAX_AGE_MS = 2 * 60 * 1000;

/**
 * The person's live position for Quick Chips' "nearest first" ranking.
 *
 * Subscribes to the app's one shared `watchPosition` (gpsWatch.js) while
 * `enabled` — no second watcher — and starts from the watch's latest fix
 * so the list is ranked the moment it opens. Returns `{ lat, lng }`, or
 * null until a fix arrives (location blocked / unavailable / still
 * warming up); callers fall back to A–Z in that case.
 */
export function useLiveLocation(enabled) {
  const [coords, setCoords] = useState(() => toCoords(getLastFix(SEED_MAX_AGE_MS)));

  useEffect(() => {
    if (!enabled) return undefined;
    const seed = toCoords(getLastFix(SEED_MAX_AGE_MS));
    if (seed) setCoords((prev) => (prev && !movedEnough(prev, seed) ? prev : seed));
    return subscribeGps((pos) => {
      const next = toCoords(pos);
      setCoords((prev) => (prev && !movedEnough(prev, next) ? prev : next));
    });
  }, [enabled]);

  return enabled ? coords : null;
}

function toCoords(pos) {
  return pos ? { lat: pos.coords.latitude, lng: pos.coords.longitude } : null;
}

function movedEnough(a, b) {
  return haversine(a.lat, a.lng, b.lat, b.lng) >= MIN_MOVE_M;
}
