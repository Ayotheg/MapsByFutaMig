import { Map } from 'lucide-react'
import { useReveal } from './landingHooks'
import { MapLink } from './shared'

/* ─── Final CTA ───
 * Light-theme rebuild (Slice 7). This is the one deliberate exception
 * to "light background throughout" — a solid violet card, per the
 * redesign plan (both reference sites close on one saturated color
 * slab). Everything else on the page stays light.
 *
 * Slice 12: top shape reworked from a uniform pill radius to an
 * inward-dipping valley — the purple card is a flat, full-bleed
 * rectangle (100vw, no maxWidth/side padding, no border-radius); a
 * `--land-bg`-colored ellipse overlaid on top (spanning the card's
 * own width exactly, no overshoot) carves a smooth U-shaped dip into
 * the top-center, flush with the viewport edges at both ends and
 * deepest in the middle — the mirror of a normal outward dome. Card
 * padding increased (esp. top) so the "Ready?" label sits with clear
 * breathing room below the dip rather than crowding it. Dot-grid
 * texture kept as-is.
 *
 * The outer `<section>` used to carry a 120px bottom padding with no
 * background of its own — that strip exposed the raw `body` color
 * (`--surface: #0b1326`, the app's dark map theme) as a dark band
 * between the card and FAQ. Removed entirely: the card is the whole
 * section now, flush against FAQ below with zero gap.
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
    <section style={{ padding: 0 }}>
      <div style={{ position: 'relative' }}>
        <div
          ref={ref}
          style={{
            position: 'relative', overflow: 'hidden',
            background: 'var(--land-accent)', borderRadius: 0,
            padding: '180px 32px 120px', textAlign: 'center',
          }}
        >
          {/* Flat dot-grid texture — repeated dots, no gradient/glow */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.16) 1.5px, transparent 1.5px)',
            backgroundSize: '20px 20px',
          }} />

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
            <MapLink
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
            </MapLink>
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

        {/* Inward valley notch — page-bg ellipse spans exactly the card's
            own (now full-bleed, 100vw) width, no overshoot, so the curve
            tapers to zero depth precisely at the viewport's left/right
            edges and dips deepest in the middle. Sits above the card
            (later in DOM = higher paint order), unaffected by the card's
            own overflow:hidden. Depth increased from the container-width
            version so it stays visually proportionate now that it spans
            the full viewport instead of a 1120px column. */}
        <div style={{
          position: 'absolute', top: -140, left: 0, right: 0, height: 280,
          background: 'var(--land-bg)', borderRadius: '50%', pointerEvents: 'none',
        }} />
      </div>
    </section>
  )
}

export default FinalCTA
