import { Link } from 'react-router-dom'
import { useReveal } from './landingHooks'

/* Two-letter monogram from a category label, e.g. "Bus Stops" -> "BS",
   "Library" -> "LI". Purely decorative — the label underneath is what
   actually identifies the category, so occasional collisions between
   two categories' initials (there are a couple here) are harmless. */
function initials(label) {
  const words = label.split(' ')
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return label.slice(0, 2).toUpperCase()
}

/* ─── Explore categories ─── */
function ExploreSection() {
  const { ref, visible } = useReveal()
  const categories = [
    { label: 'Academic Buildings' }, { label: 'Lecture Halls' },
    { label: 'Hostels' }, { label: 'Restaurants' },
    { label: 'ATMs' }, { label: 'Banks' },
    { label: 'Clinics' }, { label: 'Library' },
    { label: 'Printing Shops' }, { label: 'Laundry' },
    { label: 'Bus Stops' }, { label: 'Parking' },
    { label: 'Student Affairs' }, { label: 'Shopping Areas' },
    { label: 'Laboratories' }, { label: 'Sports Centres' },
    { label: 'Mosque' }, { label: 'Church' },
    { label: 'Fuel Stations' }, { label: 'Security Posts' },
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
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
              animationDelay: `${i * 0.03}s`,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'rgba(68,226,205,0.12)', border: '1px solid rgba(68,226,205,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Montserrat', fontWeight: 700, fontSize: 13, letterSpacing: 0.5,
                color: 'var(--teal)',
              }}>
                {initials(cat.label)}
              </div>
              <span style={{ fontFamily: 'Inter', fontSize: 12, fontWeight: 500, color: 'var(--muted)', lineHeight: 1.3 }}>{cat.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

export default ExploreSection
