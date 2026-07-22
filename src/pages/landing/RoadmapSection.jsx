import { useReveal } from './landingHooks'

/* ─── Roadmap ─── */
function RoadmapSection() {
  const { ref, visible } = useReveal()
  const items = [
    { num: '01', title: 'Smarter Navigation', body: 'AI-powered route optimization that learns campus traffic patterns and suggests the fastest paths.' },
    { num: '02', title: 'Community Reviews v2', body: 'Expanded review system with photos, detailed ratings, and verified student-only feedback.' },
    { num: '03', title: 'More Campus Services', body: 'Mapping every hostel room block, new buildings, shuttle routes, and real-time facility availability.' },
    { num: '04', title: 'Student Contributions', body: 'Let students submit new locations, flag outdated data, and help keep Maps By FUTA accurate.' },
    { num: '05', title: 'Offline Mode', body: 'Download campus maps for offline use — navigate even without mobile data.' },
  ]

  return (
    <section style={{ padding: '120px 24px', background: 'var(--bg-mid)', position: 'relative', overflow: 'hidden' }}>
      <div ref={ref} style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div className={`reveal ${visible ? 'visible' : ''}`} style={{ fontFamily: 'Montserrat', fontSize: 12, fontWeight: 700, letterSpacing: 4, color: 'var(--orange)', textTransform: 'uppercase', marginBottom: 12 }}>Roadmap</div>
          <h2 className={`reveal ${visible ? 'visible' : ''}`} style={{ fontFamily: "'Bricolage Grotesque'", fontSize: 'clamp(30px,4vw,52px)', fontWeight: 800, transitionDelay: '0.1s' }}>
            What's Coming<br /><span className="text-gradient-purple">Next.</span>
          </h2>
          <p className={`reveal ${visible ? 'visible' : ''}`} style={{ fontFamily: 'Poppins', fontSize: 16, color: 'var(--muted)', marginTop: 16, transitionDelay: '0.2s' }}>
            Maps By FUTA is just getting started. Here's where we're headed.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {items.map((item, i) => (
            <div key={item.title} className={`reveal ${visible ? 'visible' : ''} roadmap-card glass-card`} style={{ padding: '28px 24px', transitionDelay: `${i * 0.1}s` }}>
              <div style={{
                fontFamily: "'Bricolage Grotesque'", fontSize: 34, fontWeight: 800,
                color: 'var(--orange)', opacity: 0.45, lineHeight: 1, marginBottom: 16,
              }}>
                {item.num}
              </div>
              <div style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 16, color: 'var(--text)', marginBottom: 10 }}>{item.title}</div>
              <p style={{ fontFamily: 'Poppins', fontSize: 14, lineHeight: 1.7, color: 'var(--muted)', margin: 0 }}>{item.body}</p>
              <div style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(68,226,205,0.1)', border: '1px solid rgba(68,226,205,0.2)', borderRadius: 8, padding: '4px 10px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#44e2cd', display: 'inline-block' }} />
                <span style={{ fontFamily: 'Inter', fontSize: 11, color: '#44e2cd' }}>In planning</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default RoadmapSection
