import { Link } from 'react-router-dom'
import mapsFlyerImg from '../../assets/MAPSBYFUTA.jpg'
import { useReveal } from './landingHooks'

/* ─── Discover section ─── */
function DiscoverSection() {
  const { ref, visible } = useReveal()
  return (
    <section id="features" style={{ padding: '120px 24px', background: 'var(--bg-darkest)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', right: 0, top: '20%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(73,0,128,0.2) 0%, transparent 70%)', filter: 'blur(50px)', pointerEvents: 'none' }} />

      <div ref={ref} style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Label */}
        <div className={`reveal ${visible ? 'visible' : ''}`} style={{ textAlign: 'center', marginBottom: 16 }}>
          <span style={{ fontFamily: 'Montserrat', fontSize: 12, fontWeight: 700, letterSpacing: 4, color: 'var(--teal)', textTransform: 'uppercase' }}>Discover</span>
        </div>
        <h2 className={`reveal ${visible ? 'visible' : ''}`} style={{ textAlign: 'center', fontFamily: "'Bricolage Grotesque'", fontSize: 'clamp(32px,4vw,54px)', fontWeight: 800, marginBottom: 64, transitionDelay: '0.1s' }}>
          Meet <span className="text-gradient-purple">Maps By FUTA</span>
        </h2>

        <div className="flex flex-col lg:flex-row items-center gap-16">
          {/* Flyer */}
          <div className={`reveal ${visible ? 'visible' : ''} flex-1 flex justify-center`} style={{ transitionDelay: '0.15s' }}>
            <div className="animate-pulse-glow" style={{
              position: 'relative', borderRadius: 24,
              boxShadow: '0 30px 80px rgba(0,0,0,0.5), 0 0 60px rgba(183,109,255,0.2)',
              transition: 'transform 0.3s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.02) rotate(-0.5deg)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1) rotate(0deg)')}>
              <img
                src={mapsFlyerImg}
                alt="Maps By FUTA promotional flyer"
                style={{ width: '100%', maxWidth: 380, borderRadius: 24, display: 'block', objectFit: 'cover' }}
              />
              <div style={{
                position: 'absolute', bottom: -16, left: '50%', transform: 'translateX(-50%)',
                background: 'rgba(19,27,46,0.95)', backdropFilter: 'blur(16px)',
                border: '1px solid rgba(183,109,255,0.3)', borderRadius: 12,
                padding: '8px 20px', whiteSpace: 'nowrap',
              }}>
                <span style={{ fontFamily: 'Inter', fontSize: 13, color: 'var(--muted)' }}>📱 Prefer your phone? Scan to explore instantly.</span>
              </div>
            </div>
          </div>

          {/* Right copy */}
          <div className={`reveal ${visible ? 'visible' : ''} flex-1`} style={{ transitionDelay: '0.25s' }}>
            <h3 style={{ fontFamily: "'Bricolage Grotesque'", fontSize: 'clamp(28px,3.5vw,46px)', fontWeight: 800, lineHeight: 1.15, marginBottom: 20 }}>
              Built for Every<br /><span className="text-gradient-teal">FUTA Student.</span>
            </h3>
            <p style={{ fontFamily: 'Poppins', fontSize: 16, lineHeight: 1.75, color: 'var(--muted)', marginBottom: 32 }}>
              Maps By FUTA makes navigating campus simple—whether you're a fresher trying to find your lecture hall, a parent visiting for the first time, or a student heading to the bank between classes.
            </p>

            {[
              ['Never get lost on campus', 'Accurate, up-to-date campus map always in your pocket'],
              ['Discover every important location', 'From classrooms to clinics, hostels to fuel stations—475+ places mapped'],
              ['Navigate confidently with live directions', 'Turn-by-turn GPS routes so you always know where to go'],
            ].map(([title, desc]) => (
              <div key={title} className="flex items-start gap-4" style={{ marginBottom: 20 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg,#44e2cd,#03c6b2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                  <span style={{ color: '#0b1326', fontSize: 12, fontWeight: 700 }}>✓</span>
                </div>
                <div>
                  <div style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 15, color: 'var(--text)', marginBottom: 4 }}>{title}</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 14, color: 'var(--muted)' }}>{desc}</div>
                </div>
              </div>
            ))}

            <div style={{ marginTop: 36 }}>
              <Link to="/map" className="btn-primary">
                🗺️ Open the Map
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default DiscoverSection;
