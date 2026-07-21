import logoImg from '../../assets/MapssByFuta.jpg'

/* ─── Map pin SVG ─── */
export const Pin = ({ color = '#44e2cd', size = 10 }) => (
  <svg width={size} height={size * 1.3} viewBox="0 0 10 13" fill="none">
    <path d="M5 0C2.24 0 0 2.24 0 5c0 3.75 5 8 5 8s5-4.25 5-8c0-2.76-2.24-5-5-5z" fill={color} />
    <circle cx="5" cy="5" r="2" fill="white" fillOpacity={0.9} />
  </svg>
)

/* ─── Logo component ─── */
export const Logo = ({ size = 32, inverted = true }) => (
  <div className="flex items-center gap-2">
    <img
      src={logoImg}
      alt="MapsByFuta logo"
      style={{ height: size, width: 'auto', filter: inverted ? 'invert(1) brightness(1.5)' : 'none' }}
    />
  </div>
)
