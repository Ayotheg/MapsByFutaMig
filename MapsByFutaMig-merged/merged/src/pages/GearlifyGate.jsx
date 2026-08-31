import { useEffect } from 'react'
import HomeRoute from './HomeRoute'
import { grantDevAccess } from './landing/launchConfig'

/**
 * Dev-only side door around the pre-launch gate. Not linked from
 * anywhere in the UI — devs reach it by typing the URL directly.
 *
 * Renders the real map (HomeRoute) directly, in place — it does NOT
 * redirect to /map. /map itself stays locked (see RequireLaunch in
 * App.jsx, which now shows NotFoundPage pre-launch rather than
 * revealing the route exists by redirecting). /gearlify is the one
 * path that bypasses that lock entirely.
 *
 * Also flags this browser via localStorage (grantDevAccess in
 * launchConfig.js) so every on-page MapLink (Nav, Hero, Footer, etc.)
 * reads as "launched" here too, in case a dev navigates back to "/"
 * and clicks through the normal UI instead of returning to this URL.
 *
 * Same caveat as the rest of the pre-launch gate: this is a soft,
 * client-side lock, not real access control — the path and the flag
 * are both sitting in the shipped JS bundle for anyone who looks.
 */
function GearlifyGate() {
  useEffect(() => {
    grantDevAccess()
  }, [])
  return <HomeRoute />
}

export default GearlifyGate
