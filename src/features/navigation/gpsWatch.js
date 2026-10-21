/**
 * The one `navigator.geolocation.watchPosition` in the app.
 *
 * `useGpsTracking.js` (gauge + "Find my location") and
 * `NavigationController.jsx` (turn-by-turn) both used to start their own
 * watcher, so two ran side by side during navigation. Both now subscribe
 * here instead: the watch starts with the first subscriber, stops with the
 * last, and is never duplicated — including under React StrictMode's
 * mount → unmount → mount in dev (the unsubscribe in between clears it).
 *
 * `maximumAge: 0` plus the `isStale` check below mean subscribers only ever
 * see a fix taken now, never one the browser cached from an earlier place.
 * Nothing here is persisted — a reload starts with no position at all.
 */
const WATCH_OPTIONS = { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 };
const MAX_FIX_AGE_MS = 30000;

const subscribers = new Set();
let watchId = null;
let lastStaleTimestamp = null;
let lastFix = null;

function log(...args) {
  if (import.meta.env?.DEV) console.debug('[gps]', ...args);
}

// A cached fix keeps repeating one old timestamp. A device whose clock is
// simply out of step with GPS time also looks "old", but its timestamps
// keep advancing — those are let through so such a device isn't locked out.
function isStale(pos) {
  if (Date.now() - pos.timestamp <= MAX_FIX_AGE_MS) return false;
  const advancing = lastStaleTimestamp !== null && pos.timestamp > lastStaleTimestamp;
  lastStaleTimestamp = pos.timestamp;
  return !advancing;
}

function start() {
  if (watchId !== null || subscribers.size === 0) return;
  if (typeof navigator === 'undefined' || !navigator.geolocation) return;
  lastStaleTimestamp = null;
  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      if (isStale(pos)) {
        log('dropped stale fix,', Math.round((Date.now() - pos.timestamp) / 1000), 's old');
        return;
      }
      lastFix = pos;
      subscribers.forEach((s) => s.onFix(pos));
    },
    (err) => {
      log('error', err.code, err.message);
      subscribers.forEach((s) => s.onError?.(err));
    },
    WATCH_OPTIONS
  );
  log('watch started, id', watchId, '— subscribers:', subscribers.size);
}

function stop() {
  if (watchId === null) return;
  navigator.geolocation.clearWatch(watchId);
  log('watch cleared, id', watchId);
  watchId = null;
}

export function subscribeGps(onFix, onError) {
  const sub = { onFix, onError };
  subscribers.add(sub);
  start();
  return () => {
    subscribers.delete(sub);
    if (subscribers.size === 0) stop();
  };
}

/** The newest fix the watch delivered, or null if it's older than
 * `maxAgeMs` — lets a late subscriber start from where the person is now
 * instead of waiting for them to move. */
export function getLastFix(maxAgeMs = MAX_FIX_AGE_MS) {
  if (!lastFix || Date.now() - lastFix.timestamp > maxAgeMs) return null;
  return lastFix;
}

/** Throw away the current watch and begin a fresh acquisition. */
export function restartGpsWatch() {
  stop();
  start();
}

// Mobile browsers suspend the watch while the tab is hidden and can hand
// back the pre-suspend position on return, so start over when it's visible.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && subscribers.size > 0) {
      log('tab visible — restarting watch');
      restartGpsWatch();
    }
  });
}

export function gpsErrorText(err) {
  if (err?.code === 1) {
    return 'Location is blocked for this site. Tap the lock icon in the address bar, set Location to Allow, then retry.';
  }
  if (err?.code === 2) {
    return 'Location unavailable. Turn on Location (and Precise location), move outdoors, then retry.';
  }
  return 'Timed out waiting for a GPS fix. Tap retry.';
}
