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
export const LAUNCH_DATE = new Date('2026-09-20T09:00:00')

export function isLaunched() {
  return Date.now() >= LAUNCH_DATE.getTime()
}

/* ─── Dev bypass for the pre-launch gate ───
 * Visiting /gearlify (see GearlifyGate.jsx) sets this flag in
 * localStorage, then forwards to /map. useLaunchGate() below treats
 * a flagged browser as "launched" from then on, so both direct /map
 * navigation and every on-page MapLink work normally for that dev —
 * no need to keep re-visiting /gearlify on every session.
 *
 * NOTE: this is a soft, client-side gate only — same as the rest of
 * the pre-launch lock. The bundle ships to every visitor, so anyone
 * who reads the built JS can find the /gearlify path and the flag
 * name. It stops casual link-guessing and stray crawlers before
 * launch; it is not access control against a motivated visitor.
 */
const DEV_ACCESS_KEY = 'mbf_dev_access'

export function hasDevAccess() {
  try {
    return localStorage.getItem(DEV_ACCESS_KEY) === 'true'
  } catch {
    return false
  }
}

export function grantDevAccess() {
  try {
    localStorage.setItem(DEV_ACCESS_KEY, 'true')
  } catch {
    // localStorage unavailable (private browsing, storage disabled) —
    // access just won't persist across visits for this browser.
  }
}
