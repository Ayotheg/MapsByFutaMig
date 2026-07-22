import mapsLogo from "../../assets/mapsLogo.png"

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
