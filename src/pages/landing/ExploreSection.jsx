import { Link } from 'react-router-dom'
import { useReveal } from './landingHooks'

/* ─── Explore categories ─── */
function ExploreSection() {
  const { ref, visible } = useReveal()
  const categories = [
    { icon: '🏫', label: 'Academic Buildings' }, { icon: '🎓', label: 'Lecture Halls' },
    { icon: '🏠', label: 'Hostels' }, { icon: '🍽️', label: 'Restaurants' },
    { icon: '🏧', label: 'ATMs' }, { icon: '🏦', label: 'Banks' },
    { icon: '🏥', label: 'Clinics' }, { icon: '📚', label: 'Library' },
    { icon: '🖨️', label: 'Printing Shops' }, { icon: '👕', label: 'Laundry' },
    { icon: '🚌', label: 'Bus Stops' }, { icon: '🅿️', label: 'Parking' },
    { icon: '🎒', label: 'Student Affairs' }, { icon: '🛍️', label: 'Shopping Areas' },
    { icon: '🔬', label: 'Laboratories' }, { icon: '⚽', label: 'Sports Centres' },
    { icon: '🕌', label: 'Mosque' }, { icon: '⛪', label: 'Church' },
    { icon: '⛽', label: 'Fuel Stations' }, { icon: '🔒', label: 'Security Posts' },
  ]

  return (
    <section id="explore" style={{ padding: '120px 24px', background: 'var(--bg-dark)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', right: '5%', bottom: '10%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(68,226,205,0.08) 0%, transparent 70%)', filter: 'blur(60px)', pointerEvents: 'none' }} />

      <div ref={ref} style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div className={`reveal ${visible ? 'visible' : ''}`} style={{ fontFamily: 'Montserrat', fontSize: 12, fontWeight: 700, letterSpacing: 4, color: 'var(--teal)', textTransform: 'uppercase', marginBottom: 12 }}>Explore</div>
          <h2 className={`reveal ${visible ? 'visible' : ''}`} style={{ fontFamily: "'Bricolage Grotesque'", fontSize: 'clamp(30px,4vw,52px)', fontWeight: 800, transitionDelay: '0.1s' }}>
            Every Corner of<br /><span className="text-gradient-teal">FUTA Campus.</span>
          </h2>
          <p className={`reveal ${visible ? 'visible' : ''}`} style={{ fontFamily: 'Poppins', fontSize: 16, color: 'var(--muted)', marginTop: 16, transitionDelay: '0.2s' }}>
            From academic buildings to worship centres — everything mapped, everything searchable.
          </p>
        </div>

        <div className={`reveal ${visible ? 'visible' : ''}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, transitionDelay: '0.2s' }}>
          {categories.map((cat, i) => (
            <Link key={cat.label} to="/map" className="category-card" style={{
              background: 'rgba(34,42,61,0.5)', backdropFilter: 'blur(12px)',
              border: '1px solid rgba(77,67,84,0.5)', borderRadius: 16,
              padding: '20px 16px', textAlign: 'center', textDecoration: 'none',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              animationDelay: `${i * 0.03}s`,
            }}>
              <span style={{ fontSize: 28 }}>{cat.icon}</span>
              <span style={{ fontFamily: 'Inter', fontSize: 12, fontWeight: 500, color: 'var(--muted)', lineHeight: 1.3 }}>{cat.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

export default ExploreSection
