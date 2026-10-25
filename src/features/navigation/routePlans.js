import { haversine } from '../../lib/geoUtils.js';

// Routes planned in the background as soon as a destination is picked, so
// Start can begin straight away. One request per destination, mode, start
// spot and set of shortcut paths: asking again while one is in flight, or
// soon after one failed, reuses it rather than hitting the routing server
// again. Pure (fetch and clock injected) so scripts/routePlans.test.mjs can
// check it in Node.

export const PLAN_MAX_AGE_MS = 3 * 60 * 1000;
export const PLAN_RETRY_AFTER_FAIL_MS = 30 * 1000;
// Under the 40 m off-route threshold, so a reused route doesn't re-plan on
// the first fixes.
export const PLAN_MAX_MOVE_M = 20;

/**
 * `fetchRoute(from, dest, profile, paths)` → Promise of route data.
 * `get` returns a usable plan ({ promise, failed }) or null; `plan` returns
 * the usable one or starts a new request.
 */
export function createPlanCache(fetchRoute, now = () => Date.now()) {
  const plans = new Map();
  const key = (dest, profile) => `${dest.lat},${dest.lng}|${profile}`;

  function get(dest, profile, from, paths) {
    const p = plans.get(key(dest, profile));
    if (!p || p.paths !== paths) return null;
    if (now() - p.at >= (p.failed ? PLAN_RETRY_AFTER_FAIL_MS : PLAN_MAX_AGE_MS)) return null;
    return haversine(from.lat, from.lng, p.from.lat, p.from.lng) < PLAN_MAX_MOVE_M ? p : null;
  }

  function plan(dest, profile, from, paths) {
    const existing = get(dest, profile, from, paths);
    if (existing) return existing;
    for (const [k, p] of plans) if (now() - p.at >= PLAN_MAX_AGE_MS) plans.delete(k);
    const entry = { from, paths, at: now(), failed: false, promise: null };
    entry.promise = fetchRoute(from, dest, profile, paths);
    // Failures are kept briefly so a retry waits instead of firing on every fix.
    entry.promise.catch(() => {
      entry.failed = true;
      entry.at = now();
    });
    plans.set(key(dest, profile), entry);
    return entry;
  }

  return { get, plan };
}
