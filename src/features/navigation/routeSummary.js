// The distance on NavDestPanel's route card. No travel times: the routing
// server's speeds aren't Nigerian roads or campus walking. Pure so
// scripts/routeSummary.test.mjs can check it in Node.

/** "850 m", "1.2 km". */
export function fmtRouteDistance(metres) {
  if (metres < 1000) return `${Math.max(10, Math.round(metres / 10) * 10)} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}
