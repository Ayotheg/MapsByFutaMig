import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Map } from 'lucide-react'
import { useReveal } from './landingHooks'

/* ─── Final CTA ─── */
function FinalCTA() {
  const { ref, visible } = useReveal(0.2)
  const ctaRef = useRef(null)
  useEffect(() => {
    const el = ctaRef.current
    if (!el || !visible) return
    const len = el.getTotalLength()
    el.style.strokeDasharray = String(len)
    el.style.strokeDashoffset = String(len)
    el.style.transition = 'stroke-dashoffset 4s ease'
    setTimeout(() => { el.style.strokeDashoffset = '0' }, 300)
  }, [visible])

  return (
    <section style={{ padding: '140px 24px', background: 'var(--bg-mid)', position: 'relative', overflow: 'hidden', textAlign: 'center' }}>
      {/* Animated background */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.12, pointerEvents: 'none' }} viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#b76dff" stopOpacity="1" />
            <stop offset="100%" stopColor="#b76dff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <path ref={ctaRef} d="M 100 500 C 200 400 300 200 600 300 S 900 100 1100 200" stroke="#b76dff" strokeWidth="2" fill="none" />
        <path d="M 0 300 C 150 250 300 400 600 350 S 900 200 1200 300" stroke="#44e2cd" strokeWidth="1.5" fill="none" opacity="0.6" strokeDasharray="6 4" />
        {[200, 400, 600, 800, 1000].map((x, i) => (
          <circle key={i} cx={x} cy={100 + (i * 70) % 400} r={4 + (i % 3)} fill="#b76dff" className="animate-pulse-glow" />
        ))}
      </svg>

      {/* Orbs */}
      <div style={{ position: 'absolute', top: '10%', left: '10%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(73,0,128,0.35) 0%, transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '10%', right: '10%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(68,226,205,0.15) 0%, transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none' }} />

      <div ref={ref} style={{ position: 'relative', zIndex: 1 }}>
        <div className={`reveal ${visible ? 'visible' : ''}`} style={{ fontFamily: 'Montserrat', fontSize: 12, fontWeight: 700, letterSpacing: 4, color: 'var(--teal)', textTransform: 'uppercase', marginBottom: 20 }}>Ready?</div>
        <h2 className={`reveal ${visible ? 'visible' : ''}`} style={{ fontFamily: "'Bricolage Grotesque'", fontSize: 'clamp(36px,6vw,80px)', fontWeight: 800, lineHeight: 1.0, marginBottom: 24, letterSpacing: '-1px', transitionDelay: '0.1s' }}>
          Ready to Explore FUTA<br /><span className="text-gradient-mix">Like Never Before?</span>
        </h2>
        <p className={`reveal ${visible ? 'visible' : ''}`} style={{ fontFamily: 'Poppins', fontSize: 18, color: 'var(--muted)', marginBottom: 48, maxWidth: 500, margin: '0 auto 48px', transitionDelay: '0.2s' }}>
          Search. Navigate. Discover.<br />Experience campus differently.
        </p>
        <div className={`reveal ${visible ? 'visible' : ''}`} style={{ transitionDelay: '0.3s' }}>
          <Link to="/map" className="btn-primary" style={{ fontSize: 18, padding: '18px 48px', borderRadius: 18, display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <Map size={20} strokeWidth={2} /> Open Maps By FUTA
          </Link>
        </div>
        <p className={`reveal ${visible ? 'visible' : ''}`} style={{ fontFamily: 'Poppins', fontSize: 13, color: 'rgba(183,109,255,0.45)', marginTop: 24, transitionDelay: '0.4s' }}>
          Free · No download required · Open in any browser
        </p>
      </div>
    </section>
  )
}

export default FinalCTA
