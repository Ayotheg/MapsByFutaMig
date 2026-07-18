/**
 * Ported verbatim from legacy `app.js` lines ~1–6 (top-of-file consts,
 * shared by both the GPS accuracy-gauge section (~1211–1590) and the
 * Navigation module (~4364–5317)).
 */
export const GPS_GOOD = 20;
export const GPS_FAIR = 100;
export const SMOOTH_WALK = 0.45; // raised from 0.20 — less lag, less zigzag at walking speed
export const SMOOTH_VEHICLE = 0.55;
export const VEHICLE_SPEED_KMH = 15;
export const TRAIL_MAX = 80;

export function tier(accuracyMeters) {
  return accuracyMeters <= GPS_GOOD ? 'good' : accuracyMeters <= GPS_FAIR ? 'fair' : 'poor';
}
