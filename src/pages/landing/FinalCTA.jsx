import { Link } from 'react-router-dom'
import { Map } from 'lucide-react'
import { useReveal } from './landingHooks'

/* ─── Final CTA ───
 * Light-theme rebuild (Slice 7). This is the one deliberate exception
 * to "light background throughout" — a solid violet, full-bleed
 * rounded card, per the redesign plan (both reference sites close on
 * one saturated color slab). Everything else on the page stays light.
 *
 * Copy tightened rather than kept verbatim: the old "Ready to Explore
 * FUTA Like Never Before? / Search. Navigate. Discover." was a second
 * pitch, and a closer shouldn't re-pitch — it should just restate the
 * one outcome (echoing the Hero's locked-in promise) and give the one
 * remaining action left to take.
 */
function FinalCTA() {
  const { ref, visible } = useReveal(0.2)

  return (
    <section style={{ padding: '0 24px 120px' }}>
      <div
        ref={ref}
        style={{
          maxWidth: 1120, margin: '0 auto', position: 'relative', overflow: 'hidden',
          background: 'var(--land-accent)', borderRadius: 32,
          padding: '96px 32px', textAlign: 'center',
        }}
      >
        {/* Flat dot-grid texture — repeated dots, no gradient/glow */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.16) 1.5px, transparent 1.5px)',
          backgroundSize: '20px 20px',
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div
            className={`reveal ${visible ? 'visible' : ''}`}
            style={{
              fontFamily: 'Montserrat, sans-serif', fontSize: 12, fontWeight: 700,
              letterSpacing: 3, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase',
              marginBottom: 18,
            }}
          >
            Ready?
          </div>
          <h2
            className={`reveal ${visible ? 'visible' : ''}`}
            style={{
              fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800,
              fontSize: 'clamp(32px,5vw,56px)', lineHeight: 1.1, color: '#fff',
              margin: 0, marginBottom: 18, transitionDelay: '0.1s',
            }}
          >
            Know exactly where you're going.
          </h2>
          <p
            className={`reveal ${visible ? 'visible' : ''}`}
            style={{
              fontFamily: 'Poppins, sans-serif', fontSize: 16, lineHeight: 1.6,
              color: 'rgba(255,255,255,0.82)', maxWidth: 460, margin: '0 auto',
              transitionDelay: '0.2s',
            }}
          >
            475+ FUTA locations, recent photos, and directions more current than Google Maps.
          </p>

          <div className={`reveal ${visible ? 'visible' : ''}`} style={{ marginTop: 40, transitionDelay: '0.3s' }}>
            <Link
              to="/map"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                background: '#fff', color: 'var(--land-accent)',
                fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: 16,
                padding: '16px 40px', borderRadius: 'var(--land-radius-pill)',
                textDecoration: 'none', transition: 'transform 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px) scale(1.03)' }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0) scale(1)' }}
            >
              <Map size={19} strokeWidth={2} /> Open the Map
            </Link>
          </div>

          <p
            className={`reveal ${visible ? 'visible' : ''}`}
            style={{
              fontFamily: 'Poppins, sans-serif', fontSize: 12, color: 'rgba(255,255,255,0.6)',
              marginTop: 22, transitionDelay: '0.4s',
            }}
          >
            475+ locations mapped · free · no download
          </p>
        </div>
      </div>
    </section>
  )
}

export default FinalCTA
