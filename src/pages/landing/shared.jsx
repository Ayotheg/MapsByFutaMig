import { Link } from 'react-router-dom'
import mapsLogo from "../../assets/mapsLogo.png"
import { useDrawRoute } from './landingHooks'

export const MapLink = ({ children, ...rest }) => (
  <Link to="/map" {...rest}>
    {children}
  </Link>
)

export const Logo = ({ size = 44 }) => (
  <div className="flex items-center gap-2">
    <img src={mapsLogo} alt="MapsByFuta logo" style={{ height: size, width: 'auto', display: 'block' }} />
  </div>
)

/**
 * Shared dotted-route SVG motif — "you are here" (violet dot + soft ring)
 * to a destination pin (teal teardrop), joined by a dashed path that
 * self-draws on mount. This is the one deliberate "yes, it's a map"
 * decorative cue the redesign plan calls for, reused as-is (same path,
 * same markers) between Hero's full-bleed background and VideoSection's
 * card background so the two sections read as visually connected.
 * `opacity` controls how loud it is per-placement — Hero wants it fairly
 * quiet behind copy, VideoSection wants it near-invisible behind the
 * poster image.
 */
export const RouteMotif = ({ opacity = 0.5, className, style }) => {
  const pathRef = useDrawRoute({ duration: 2600, delay: 300 })
  return (
    <svg
      viewBox="0 0 600 360"
      className={className}
      style={{ opacity, ...style }}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        ref={pathRef}
        d="M 50 300 C 150 280 170 190 260 180 S 400 110 550 60"
        stroke="var(--land-accent)"
        strokeWidth="2.5"
        strokeDasharray="2 10"
        strokeLinecap="round"
      />
      {/* Start marker — "you are here" */}
      <circle cx="50" cy="300" r="15" fill="var(--land-accent)" opacity="0.14" />
      <circle cx="50" cy="300" r="6" fill="var(--land-accent)" />
      {/* End marker — destination pin, teal teardrop */}
      <path
        d="M550 38c-13 0-23 10-23 23 0 17 23 39 23 39s23-22 23-39c0-13-10-23-23-23z"
        fill="var(--land-secondary-accent)"
      />
      <circle cx="550" cy="61" r="7.5" fill="#fff" opacity="0.92" />
    </svg>
  )
}
