import { Link } from 'react-router-dom'
import mapsLogo from "../../assets/mapsLogo.png"
import { useDrawRoute, useLaunchGate } from './landingHooks'

/**
 * Drop-in replacement for `<Link to="/map">` used by every "Open the
 * map" / "Start Navigating" button across the landing page (Nav, Hero,
 * ExploreSection, FinalCTA, Footer). Before LAUNCH_DATE (launchConfig.js)
 * it renders the exact same look but as an inert, non-clickable element
 * — dimmed, `cursor: not-allowed`, no navigation — instead of an actual
 * link to /map. Once the date passes it renders as a normal Link, no
 * code changes needed anywhere that uses it.
 */
export const MapLink = ({ children, style, onMouseEnter, onMouseLeave, ...rest }) => {
  const { launched } = useLaunchGate()

  if (launched) {
    return (
      <Link to="/map" style={style} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} {...rest}>
        {children}
      </Link>
    )
  }

  return (
    <span
      aria-disabled="true"
      title="The map isn't open yet — check back at launch"
      style={{ ...style, opacity: 0.45, cursor: 'not-allowed', pointerEvents: 'none' }}
      {...rest}
    >
      {children}
    </span>
  )
}

/* ─── Map pin SVG ─── */
export const Pin = ({ color = '#44e2cd', size = 10 }) => (
  <svg width={size} height={size * 1.3} viewBox="0 0 10 13" fill="none">
    <path d="M5 0C2.24 0 0 2.24 0 5c0 3.75 5 8 5 8s5-4.25 5-8c0-2.76-2.24-5-5-5z" fill={color} />
    <circle cx="5" cy="5" r="2" fill="white" fillOpacity={0.9} />
  </svg>
)

/**
 * Logo mark. Was previously `MapssByFuta.jpg` — a flattened JPG, so it
 * carried a baked-in background square (JPGs have no alpha channel) and
 * needed an `invert()` filter hack to read on a dark navbar. Swapped for
 * `logo-mark.svg` (the same mark, sourced from `public/favicon.svg`,
 * which is already a proper transparent vector in the real brand colors
 * per About.md) — no background, no filter hack needed.
 */
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
