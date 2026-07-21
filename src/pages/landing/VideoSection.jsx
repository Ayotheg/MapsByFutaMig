import { useReveal } from './landingHooks'

/* ─── Video section ─── */
function VideoSection() {
  const { ref, visible } = useReveal()
  return (
    <section id="video" style={{ padding: '120px 24px', background: 'var(--bg-darkest)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, rgba(73,0,128,0.2) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div ref={ref} style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
        <div className={`reveal ${visible ? 'visible' : ''}`} style={{ fontFamily: 'Montserrat', fontSize: 12, fontWeight: 700, letterSpacing: 4, color: 'var(--teal)', textTransform: 'uppercase', marginBottom: 12 }}>Demo</div>
        <h2 className={`reveal ${visible ? 'visible' : ''}`} style={{ fontFamily: "'Bricolage Grotesque'", fontSize: 'clamp(30px,4vw,52px)', fontWeight: 800, marginBottom: 16, transitionDelay: '0.1s' }}>
          Watch Maps By FUTA<br /><span className="text-gradient-purple">in Action.</span>
        </h2>
        <p className={`reveal ${visible ? 'visible' : ''}`} style={{ fontFamily: 'Poppins', fontSize: 17, color: 'var(--muted)', marginBottom: 48, transitionDelay: '0.2s' }}>
          See how Maps By FUTA transforms the way students navigate campus.
        </p>

        <div className={`reveal-scale ${visible ? 'visible' : ''}`} style={{ transitionDelay: '0.25s' }}>
          <div className="animate-pulse-glow" style={{
            background: 'rgba(19,27,46,0.85)', backdropFilter: 'blur(20px)',
            border: '1px solid rgba(183,109,255,0.3)', borderRadius: 28,
            padding: 8, overflow: 'hidden',
            boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #131b2e 0%, #1a0d2e 50%, #131b2e 100%)',
              borderRadius: 22, height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: 20, position: 'relative', overflow: 'hidden',
            }}>
              {/* Decorative route lines */}
              <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.15 }} viewBox="0 0 800 420" preserveAspectRatio="xMidYMid slice">
                <path d="M 0 200 C 150 200 200 100 400 150 S 600 280 800 200" stroke="#b76dff" strokeWidth="2" fill="none" />
                <path d="M 0 300 C 200 280 300 200 500 250 S 700 180 800 300" stroke="#44e2cd" strokeWidth="1.5" fill="none" />
                <circle cx="200" cy="150" r="4" fill="#b76dff" />
                <circle cx="400" cy="150" r="4" fill="#44e2cd" />
                <circle cx="600" cy="240" r="4" fill="#b76dff" />
              </svg>

              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(183,109,255,0.2), rgba(68,226,205,0.1))',
                border: '2px solid rgba(183,109,255,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'transform 0.2s',
                boxShadow: '0 0 30px rgba(183,109,255,0.3)',
              }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
                <div style={{ width: 0, height: 0, borderTop: '18px solid transparent', borderBottom: '18px solid transparent', borderLeft: '30px solid #ddb7ff', marginLeft: 6 }} />
              </div>

              <div>
                <div style={{ fontFamily: 'Montserrat', fontSize: 13, fontWeight: 600, color: 'var(--muted)', letterSpacing: 2, textTransform: 'uppercase' }}>Commercial Coming Soon</div>
                <div style={{ fontFamily: 'Poppins', fontSize: 13, color: 'rgba(183,109,255,0.5)', marginTop: 4 }}>Video placeholder — replace with the commercial</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default VideoSection
