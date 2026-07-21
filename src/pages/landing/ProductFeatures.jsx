import { useReveal } from './landingHooks'

/* ─── Feature showcase ─── */
function FeatureShowcase({ index, title, emoji, tagline, bullets, visual }) {
  const { ref, visible } = useReveal()
  const isEven = index % 2 === 0

  return (
    <div ref={ref} className={`reveal ${visible ? 'visible' : ''} flex flex-col ${isEven ? 'lg:flex-row' : 'lg:flex-row-reverse'} items-center gap-16`} style={{ marginBottom: 100, transitionDelay: `${0.05 * index}s` }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'Montserrat', fontSize: 12, fontWeight: 700, letterSpacing: 4, color: 'var(--teal)', textTransform: 'uppercase', marginBottom: 12 }}>
          Feature {String(index + 1).padStart(2, '0')}
        </div>
        <h3 style={{ fontFamily: "'Bricolage Grotesque'", fontSize: 'clamp(26px,3vw,42px)', fontWeight: 800, lineHeight: 1.15, marginBottom: 16 }}>
          {emoji} {title}
        </h3>
        <p style={{ fontFamily: 'Poppins', fontSize: 16, lineHeight: 1.75, color: 'var(--muted)', marginBottom: 28 }}>{tagline}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {bullets.map(b => (
            <div key={b} className="flex items-center gap-3">
              <span style={{ color: '#44e2cd', fontSize: 14 }}>→</span>
              <span style={{ fontFamily: 'Poppins', fontSize: 15, color: 'var(--text)' }}>{b}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        {visual}
      </div>
    </div>
  )
}

/* ─── Feature visuals ─── */
const MapFeatureVisual = () => (
  <div className="glass-card feature-card-hover" style={{ width: '100%', maxWidth: 400, padding: 24, borderRadius: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
    <div style={{ background: '#e8f0e8', borderRadius: 16, overflow: 'hidden', height: 240, position: 'relative' }}>
      <svg width="100%" height="100%" viewBox="0 0 360 240">
        <rect width="360" height="240" fill="#e8f0e8" />
        <line x1="0" y1="80" x2="360" y2="80" stroke="#d0dcd0" strokeWidth="10" />
        <line x1="0" y1="160" x2="360" y2="160" stroke="#d0dcd0" strokeWidth="6" />
        <line x1="100" y1="0" x2="100" y2="240" stroke="#d0dcd0" strokeWidth="8" />
        <line x1="240" y1="0" x2="240" y2="240" stroke="#d0dcd0" strokeWidth="6" />
        <rect x="110" y="20" width="80" height="50" fill="#c8e0c8" rx="6" />
        <rect x="110" y="90" width="80" height="60" fill="#c8e0c8" rx="6" />
        <rect x="250" y="20" width="80" height="50" fill="#c8e0c8" rx="6" />
        <rect x="250" y="90" width="80" height="70" fill="#c8e0c8" rx="6" />
        <rect x="20" y="90" width="60" height="60" fill="#c0d8c0" rx="6" />
        <rect x="110" y="170" width="80" height="55" fill="#c8e0c8" rx="6" />
        <rect x="250" y="170" width="80" height="55" fill="#c8e0c8" rx="6" />
        {[
          [150, 45, '#b76dff'], [290, 45, '#44e2cd'], [150, 120, '#ffb95f'],
          [290, 125, '#b76dff'], [50, 120, '#44e2cd'], [150, 197, '#ffb95f'],
        ].map(([x, y, c], i) => (
          <circle key={i} cx={x} cy={y} r={7} fill={c} opacity={0.9} />
        ))}
      </svg>
    </div>
    <div className="flex flex-wrap gap-2" style={{ marginTop: 16 }}>
      {['🏫 Academic', '🏧 ATM', '🏥 Clinic', '🍽️ Food', '🏠 Hostels'].map(cat => (
        <span key={cat} style={{ fontFamily: 'Inter', fontSize: 12, background: 'rgba(183,109,255,0.12)', border: '1px solid rgba(183,109,255,0.2)', borderRadius: 8, padding: '4px 10px', color: 'var(--purple-light)' }}>{cat}</span>
      ))}
    </div>
  </div>
)

const SearchFeatureVisual = () => (
  <div className="glass-card feature-card-hover" style={{ width: '100%', maxWidth: 400, padding: 28, borderRadius: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
    <div style={{ background: 'rgba(183,109,255,0.08)', border: '1px solid rgba(183,109,255,0.2)', borderRadius: 14, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <span style={{ fontSize: 16 }}>🔍</span>
      <span style={{ fontFamily: 'Inter', fontSize: 14, color: 'var(--muted)' }}>CBT Centre...</span>
      <div style={{ marginLeft: 'auto', background: '#b76dff', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontFamily: 'Inter', color: 'white' }}>Search</div>
    </div>
    {[
      { name: 'CBT Centre', cat: 'Academic', dist: '200m', color: '#b76dff' },
      { name: 'Senate Building', cat: 'Admin', dist: '450m', color: '#44e2cd' },
      { name: 'Main Library', cat: 'Academic', dist: '600m', color: '#ffb95f' },
      { name: 'FUTA South Gate', cat: 'Entrance', dist: '1.2km', color: '#b76dff' },
    ].map((r, i) => (
      <div key={r.name} className="flex items-center gap-3" style={{
        padding: '10px 12px', borderRadius: 12, marginBottom: 6,
        background: i === 0 ? 'rgba(183,109,255,0.12)' : 'rgba(34,42,61,0.4)',
        border: `1px solid ${i === 0 ? 'rgba(183,109,255,0.3)' : 'rgba(77,67,84,0.3)'}`,
        transition: 'all 0.2s',
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Inter', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{r.name}</div>
          <div style={{ fontFamily: 'Poppins', fontSize: 11, color: 'var(--muted)' }}>{r.cat}</div>
        </div>
        <div style={{ fontFamily: 'Inter', fontSize: 12, color: '#44e2cd' }}>{r.dist}</div>
      </div>
    ))}
  </div>
)

const NavFeatureVisual = () => (
  <div className="glass-card feature-card-hover" style={{ width: '100%', maxWidth: 400, padding: 28, borderRadius: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
    <div style={{ background: '#e8f0e8', borderRadius: 16, height: 180, position: 'relative', overflow: 'hidden', marginBottom: 20 }}>
      <svg width="100%" height="100%" viewBox="0 0 360 180">
        <rect width="360" height="180" fill="#e8f0e8" />
        <line x1="0" y1="90" x2="360" y2="90" stroke="#d0dcd0" strokeWidth="8" />
        <line x1="180" y1="0" x2="180" y2="180" stroke="#d0dcd0" strokeWidth="6" />
        <path d="M 60 150 C 100 150 140 90 180 90 S 260 50 300 30" stroke="#b76dff" strokeWidth="4" fill="none" strokeDasharray="8 4" strokeLinecap="round" />
        <circle cx="60" cy="150" r="8" fill="#44e2cd" />
        <circle cx="300" cy="30" r="8" fill="#b76dff" />
        {[100, 140, 200, 250].map((x, i) => (
          <circle key={i} cx={x} cy={90 - (i % 2) * 40 + (i % 3) * 20} r={4} fill="rgba(183,109,255,0.6)" />
        ))}
      </svg>
      <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(11,19,38,0.9)', borderRadius: 8, padding: '4px 10px' }}>
        <span style={{ fontFamily: 'Inter', fontSize: 11, color: '#44e2cd' }}>📍 Current Location</span>
      </div>
      <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(11,19,38,0.9)', borderRadius: 8, padding: '4px 10px' }}>
        <span style={{ fontFamily: 'Inter', fontSize: 11, color: '#b76dff' }}>🎯 Destination</span>
      </div>
    </div>
    <div className="flex gap-3">
      {[['🚶', '8 min', 'Walk'], ['🚗', '3 min', 'Drive'], ['📡', 'Live', 'GPS']].map(([icon, val, label]) => (
        <div key={label} style={{ flex: 1, background: 'rgba(34,42,61,0.5)', borderRadius: 12, padding: '10px', textAlign: 'center', border: '1px solid rgba(77,67,84,0.4)' }}>
          <div style={{ fontSize: 16 }}>{icon}</div>
          <div style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 15, color: 'var(--purple-light)' }}>{val}</div>
          <div style={{ fontFamily: 'Poppins', fontSize: 10, color: 'var(--muted)' }}>{label}</div>
        </div>
      ))}
    </div>
  </div>
)

const ReviewsFeatureVisual = () => (
  <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 14 }}>
    {[
      { name: 'FoodCourt A', rating: 4.8, reviews: 124, tag: 'Restaurant', comment: "Best jollof on campus, always fresh!" },
      { name: 'FUTA Health Centre', rating: 4.5, reviews: 89, tag: 'Clinic', comment: "Fast service, always available." },
      { name: 'Zenith Bank ATM', rating: 4.2, reviews: 210, tag: 'ATM', comment: "Rarely out of cash, good location." },
    ].map(r => (
      <div key={r.name} className="glass-card feature-card-hover" style={{ padding: '16px 20px' }}>
        <div className="flex items-start justify-between" style={{ marginBottom: 8 }}>
          <div>
            <div style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>{r.name}</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: 'var(--muted)' }}>{r.tag} · {r.reviews} reviews</div>
          </div>
          <div className="flex items-center gap-1">
            <span style={{ color: '#ffb95f', fontSize: 14 }}>★</span>
            <span style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 14, color: '#ffb95f' }}>{r.rating}</span>
          </div>
        </div>
        <p style={{ fontFamily: 'Poppins', fontSize: 13, color: 'var(--muted)', fontStyle: 'italic' }}>"{r.comment}"</p>
      </div>
    ))}
  </div>
)

const MobileFeatureVisual = () => (
  <div style={{ position: 'relative', width: 200, margin: '0 auto' }}>
    <div style={{ position: 'absolute', inset: '-30px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(183,109,255,0.2) 0%, transparent 70%)', filter: 'blur(20px)' }} />
    <div className="animate-float" style={{
      width: 200, height: 400, background: 'linear-gradient(160deg,#2d2d45,#1a1a2e)',
      borderRadius: 36, border: '2px solid rgba(183,109,255,0.3)',
      boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 30px rgba(183,109,255,0.1)',
      overflow: 'hidden', position: 'relative',
    }}>
      <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 60, height: 18, background: '#1a1a2e', borderRadius: '0 0 10px 10px' }} />
      <div style={{ padding: '30px 14px 14px' }}>
        <div style={{ background: 'rgba(183,109,255,0.12)', borderRadius: 12, padding: '8px 12px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10 }}>🔍</span>
          <span style={{ fontFamily: 'Inter', fontSize: 10, color: 'var(--muted)' }}>Search FUTA campus...</span>
        </div>
        <div style={{ background: '#e8f0e8', borderRadius: 12, height: 160, overflow: 'hidden', marginBottom: 12, position: 'relative' }}>
          <svg width="100%" height="100%" viewBox="0 0 172 160">
            <rect width="172" height="160" fill="#e8f0e8" />
            <line x1="0" y1="60" x2="172" y2="60" stroke="#d0dcd0" strokeWidth="6" />
            <line x1="86" y1="0" x2="86" y2="160" stroke="#d0dcd0" strokeWidth="5" />
            <circle cx="86" cy="80" r="8" fill="#b76dff" />
            <circle cx="40" cy="40" r="6" fill="#44e2cd" />
            <circle cx="140" cy="100" r="6" fill="#ffb95f" />
          </svg>
        </div>
        <div className="flex gap-2">
          {['📍 Near You', '🏧 ATM', '🍽️ Food'].map(cat => (
            <div key={cat} style={{ flex: 1, background: 'rgba(34,42,61,0.6)', borderRadius: 8, padding: '6px 4px', textAlign: 'center', fontSize: 9, fontFamily: 'Inter', color: 'var(--muted)' }}>{cat}</div>
          ))}
        </div>
      </div>
    </div>
  </div>
)

function ProductFeatures() {
  const { ref, visible } = useReveal()
  const features = [
    {
      title: 'Interactive Campus Map',
      emoji: '🗺️',
      tagline: 'Explore every corner of FUTA — lecture halls, hostels, restaurants, ATMs, banks, clinics, bus stops, places of worship, sports centres, shopping areas, and many more campus locations.',
      bullets: ['475+ mapped locations', 'Categorized by type', 'Regular map updates', 'Detailed location info'],
      visual: <MapFeatureVisual />,
    },
    {
      title: 'Smart Search',
      emoji: '🔍',
      tagline: 'Find any campus location instantly with our intelligent search engine. Type a few characters and get instant results with distance, category, and directions.',
      bullets: ['Instant autocomplete', 'Nearby suggestions', 'Distance-aware results', 'Category shortcuts'],
      visual: <SearchFeatureVisual />,
    },
    {
      title: 'Turn-by-Turn Navigation',
      emoji: '🧭',
      tagline: 'From your current location to anywhere on campus — get precise walking or driving routes with live GPS, real-time tracking, ETA, and voice guidance.',
      bullets: ['Walking & driving routes', 'Estimated arrival time', 'Live GPS tracking', 'Voice navigation'],
      visual: <NavFeatureVisual />,
    },
    {
      title: 'Community Reviews',
      emoji: '⭐',
      tagline: 'Students rate restaurants, banks, printing shops, pharmacies, and other campus services — helping fellow students make informed decisions every day.',
      bullets: ['Star ratings & reviews', 'Verified student feedback', 'Most popular places', 'Real-time updates'],
      visual: <ReviewsFeatureVisual />,
    },
    {
      title: 'Mobile First Experience',
      emoji: '📱',
      tagline: 'Designed to be beautiful and fast on every screen. Open it in any browser — no app download required. FUTA navigation, always in your pocket.',
      bullets: ['Progressive Web App', 'No download needed', 'Works offline (soon)', 'Fast & lightweight'],
      visual: <MobileFeatureVisual />,
    },
  ]

  return (
    <section style={{ padding: '120px 24px', background: 'var(--bg-dark)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: '10%', top: '10%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(73,0,128,0.12) 0%, transparent 70%)', filter: 'blur(60px)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div ref={ref} style={{ textAlign: 'center', marginBottom: 80 }}>
          <div className={`reveal ${visible ? 'visible' : ''}`} style={{ fontFamily: 'Montserrat', fontSize: 12, fontWeight: 700, letterSpacing: 4, color: 'var(--teal)', textTransform: 'uppercase', marginBottom: 12 }}>Product</div>
          <h2 className={`reveal ${visible ? 'visible' : ''}`} style={{ fontFamily: "'Bricolage Grotesque'", fontSize: 'clamp(32px,4vw,52px)', fontWeight: 800, transitionDelay: '0.1s' }}>
            Everything You Need to<br /><span className="text-gradient-mix">Navigate FUTA.</span>
          </h2>
        </div>

        {features.map((f, i) => (
          <FeatureShowcase key={f.title} index={i} {...f} />
        ))}
      </div>
    </section>
  )
}

export default ProductFeatures
