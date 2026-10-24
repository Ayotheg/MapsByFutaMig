// The "15 min · 1.2 km · Arrive 10:37 PM" card in NavDestPanel. Times are
// the routing server's estimate for the travel mode (walking ≈ 5 km/h),
// so no waiting, crowds or traffic. Pure so scripts/routeSummary.test.mjs
// can check it in Node.

/** "1 min", "15 min", "1 h 5 min". */
export function fmtDuration(seconds) {
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** "850 m", "1.2 km". */
export function fmtRouteDistance(metres) {
  if (metres < 1000) return `${Math.max(10, Math.round(metres / 10) * 10)} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

/** Clock time `seconds` from `now`, e.g. "10:37 PM" (or "22:37" by locale). */
export function arrivalTime(seconds, now = Date.now()) {
  return new Date(now + seconds * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
