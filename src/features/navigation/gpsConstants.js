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

// UI redesign (per UI_REDESIGN_GUIDE.md, Nav/GPS HUD session — explicit
// user-flagged bug fix, not a guessed default): the close "eye level" zoom
// the map snaps to the moment turn-by-turn navigation starts. Previously
// there was no fixed nav zoom at all — `startNavigation()` called
// `map.fitBounds()` on the *whole route*, which on anything but a short
// walk landed near `minZoom` (14, see MapShell.jsx) and then just sat
// there for the rest of the session (later ticks only ever `panTo` to
// recenter, never re-zoom) — on mobile that read as the map being
// permanently stuck zoomed out. This constant is only the *starting*
// framing; nothing disables interaction, so the user can still pinch out
// (down to `minZoom`) or in (up to `maxZoom`, 19) at any time.
export const NAV_START_ZOOM = 18;

export function tier(accuracyMeters) {
  return accuracyMeters <= GPS_GOOD ? 'good' : accuracyMeters <= GPS_FAIR ? 'fair' : 'poor';
}
