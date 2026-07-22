import { Link } from 'react-router-dom'
import { Frown, Clock, Users, ArrowRight } from 'lucide-react'
import { useReveal } from './landingHooks'

/* ─── Why section ─── */
function WhySection() {
  const { ref, visible } = useReveal()
  const cards = [
    { Icon: Frown, title: 'Freshers Get Lost', body: 'Every new student wastes hours asking for directions to lecture halls, hostels, and cafeterias. The first week on campus shouldn\'t be a navigation test.' },
    { Icon: Clock, title: 'Time Lost to Confusion', body: 'Students miss classes, appointments, and events simply because campus is vast and confusing. Time is too valuable to waste getting lost.' },
    { Icon: Users, title: 'Visitors Struggle', body: 'Parents, guests, and new staff are left to wander a large campus with no reliable guidance, creating frustration and a poor first impression.' },
  ]

  return (
    <section style={{ padding: '120px 24px', background: 'var(--bg-mid)', position: 'relative' }}>
      <div ref={ref} style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div className="flex flex-col lg:flex-row gap-16 items-start">
          <div style={{ flex: 1 }}>
            <div className={`reveal ${visible ? 'visible' : ''}`} style={{ fontFamily: 'Montserrat', fontSize: 12, fontWeight: 700, letterSpacing: 4, color: 'var(--orange)', textTransform: 'uppercase', marginBottom: 12 }}>Our Why</div>
            <h2 className={`reveal ${visible ? 'visible' : ''}`} style={{ fontFamily: "'Bricolage Grotesque'", fontSize: 'clamp(30px,4vw,50px)', fontWeight: 800, lineHeight: 1.15, marginBottom: 24, transitionDelay: '0.1s' }}>
              Campus Shouldn't<br /><span className="text-gradient-purple">Be a Maze.</span>
            </h2>
            <p className={`reveal ${visible ? 'visible' : ''}`} style={{ fontFamily: 'Poppins', fontSize: 16, lineHeight: 1.8, color: 'var(--muted)', marginBottom: 28, transitionDelay: '0.2s' }}>
              FUTA is a large, vibrant campus with hundreds of buildings, services, and facilities. But for too long, navigating it has relied on asking strangers, following handmade signs, or simply wandering.
            </p>
            <p className={`reveal ${visible ? 'visible' : ''}`} style={{ fontFamily: 'Poppins', fontSize: 16, lineHeight: 1.8, color: 'var(--muted)', transitionDelay: '0.3s' }}>
              Maps By FUTA was built to solve this—once and for all. A precise, beautiful, purpose-built navigation platform that puts the entire FUTA campus in your hands. No more asking, no more wandering. Just navigate.
            </p>
            <div className={`reveal ${visible ? 'visible' : ''}`} style={{ marginTop: 36, transitionDelay: '0.4s' }}>
              <Link to="/map" className="btn-primary">
                Start Navigating <ArrowRight size={16} strokeWidth={2} />
              </Link>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {cards.map((c, i) => (
              <div key={c.title} className={`reveal ${visible ? 'visible' : ''} glass-card`} style={{ padding: '24px 28px', transitionDelay: `${0.2 + i * 0.1}s` }}>
                <div style={{ marginBottom: 12 }}><c.Icon size={28} strokeWidth={1.75} color="var(--orange)" /></div>
                <div style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 16, marginBottom: 8, color: 'var(--text)' }}>{c.title}</div>
                <p style={{ fontFamily: 'Poppins', fontSize: 14, lineHeight: 1.7, color: 'var(--muted)', margin: 0 }}>{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default WhySection
