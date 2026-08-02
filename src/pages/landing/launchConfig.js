/* ─── Single source of truth for the pre-launch gate ───
 * Both LaunchCountdown.jsx (the big number section) and every "/map"
 * button/link across the landing page — Nav, Hero, ExploreSection,
 * FinalCTA, Footer, all via the shared <MapLink> in shared.jsx — read
 * from this one date. Update it here once and the countdown numbers
 * AND the disabled/enabled state of every map button change together.
 *
 * ██ EDIT ME — this is the date/time to change ██
 * Interpreted in the visitor's own local timezone, no timezone math
 * needed on our end.
 */
export const LAUNCH_DATE = new Date('2026-09-15T09:00:00')

export function isLaunched() {
  return Date.now() >= LAUNCH_DATE.getTime()
}
