import { useReveal } from './landingHooks'

/* ─── Support section ─── */
function SupportSection() {
  const { ref, visible } = useReveal()
  return (
    <section id="support" style={{ padding: '120px 24px', background: 'var(--bg-dark)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 50%, rgba(73,0,128,0.3) 0%, transparent 65%)', pointerEvents: 'none' }} />

      <div ref={ref} style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center' }}>
        <div className={`reveal ${visible ? 'visible' : ''}`} style={{ fontFamily: 'Montserrat', fontSize: 12, fontWeight: 700, letterSpacing: 4, color: 'var(--teal)', textTransform: 'uppercase', marginBottom: 12 }}>Support</div>

        <div className={`reveal-scale ${visible ? 'visible' : ''} animate-pulse-glow`} style={{
          background: 'linear-gradient(135deg, rgba(73,0,128,0.25) 0%, rgba(183,109,255,0.1) 50%, rgba(73,0,128,0.25) 100%)',
          border: '1px solid rgba(183,109,255,0.35)', borderRadius: 28,
          padding: '60px 48px', backdropFilter: 'blur(20px)',
          transitionDelay: '0.1s',
        }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>💜</div>
          <h2 style={{ fontFamily: "'Bricolage Grotesque'", fontSize: 'clamp(28px,4vw,48px)', fontWeight: 800, marginBottom: 20, lineHeight: 1.15 }}>
            Help Build the Future of<br /><span className="text-gradient-purple">Campus Navigation.</span>
          </h2>
          <p style={{ fontFamily: 'Poppins', fontSize: 16, lineHeight: 1.8, color: 'var(--muted)', marginBottom: 32, maxWidth: 560, margin: '0 auto 32px' }}>
            Maps By FUTA is independently developed and maintained to improve campus life at FUTA. Community support helps expand features, improve map accuracy, add new locations, and keep the platform free for every student, forever.
          </p>
          <div className="flex flex-wrap gap-4 justify-center" style={{ marginBottom: 40 }}>
            {['🗺️ Expand the map', '⚡ Faster features', '📡 Better GPS', '🆓 Always free'].map(item => (
              <div key={item} style={{ background: 'rgba(183,109,255,0.12)', border: '1px solid rgba(183,109,255,0.25)', borderRadius: 10, padding: '8px 16px', fontFamily: 'Inter', fontSize: 13, color: 'var(--purple-light)' }}>
                {item}
              </div>
            ))}
          </div>
          <a
            href="https://www.oncrowdr.com/explore/c/fund-mapsbyfuta"
            target="_blank"
            rel="noreferrer"
            className="btn-primary"
            style={{ fontSize: 16, padding: '16px 40px' }}
          >
            💜 Support Maps By FUTA
          </a>
          <p style={{ fontFamily: 'Poppins', fontSize: 13, color: 'rgba(183,109,255,0.5)', marginTop: 20 }}>
            Every contribution, no matter how small, makes a difference.
          </p>
        </div>
      </div>
    </section>
  )
}

export default SupportSection
