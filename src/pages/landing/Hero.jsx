import { MapPin, Map, Play } from 'lucide-react'
import { useReveal } from './landingHooks'
import { RouteMotif, MapLink } from './shared'

/**
 * Floating preview card content. No real product screenshot is in the
 * repo yet (src/assets/*.jpg are old promo/logo graphics, not app
 * screenshots — see shared.jsx's note on why they were replaced). Per
 * the redesign plan, ship a clearly-labeled placeholder instead of
 * porting/faking one: swap the body of this component for a real
 * `<img>` screenshot of /map once one is available — nothing else
 * about the surrounding card needs to change.
 */
function MapPreviewPlaceholder() {
  const dot = (color) => ({ width: 10, height: 10, borderRadius: '50%', background: color })
  const pins = [
    { top: '28%', left: '22%', color: 'var(--land-secondary-accent)' },
    { top: '48%', left: '58%', color: 'var(--land-accent)' },
    { top: '68%', left: '34%', color: 'var(--land-secondary-accent)' },
    { top: '38%', left: '76%', color: 'var(--land-secondary-accent)' },
  ]

  return (
    <div
      style={{
        position: 'relative', maxWidth: 860, margin: '0 auto',
        background: 'var(--land-surface)', border: '1px solid var(--land-border)',
        borderRadius: '16px 16px 0 0', overflow: 'hidden',
        boxShadow: '0 30px 70px rgba(20,10,40,0.10)',
      }}
    >
      {/* Faux browser chrome */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderBottom: '1px solid var(--land-border)' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <span style={dot('#ffb95f')} />
          <span style={dot('#44c98a')} />
          <span style={dot('#e2645a')} />
        </div>
        <div style={{
          flex: 1, background: 'var(--land-surface-alt)', border: '1px solid var(--land-border)',
          borderRadius: 999, padding: '6px 14px', textAlign: 'left',
          fontFamily: 'Poppins, sans-serif', fontSize: 12, color: 'var(--land-text-muted)',
        }}>
          mapsbyfuta.xyz/map
        </div>
      </div>

      {/* Faux map body */}
      <div style={{ position: 'relative', aspectRatio: '16 / 8', background: 'var(--land-surface-alt)' }}>
        {/* Search bar */}
        <div style={{
          position: 'absolute', top: 16, left: 16, right: 16, maxWidth: 260,
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--land-surface)', border: '1px solid var(--land-border)',
          borderRadius: 10, padding: '8px 12px', boxShadow: '0 6px 16px rgba(20,10,40,0.06)',
        }}>
          <MapPin size={13} strokeWidth={2} color="var(--land-text-muted)" />
          <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: 12, color: 'var(--land-text-muted)' }}>Search FUTA campus…</span>
        </div>

        {pins.map((p, i) => (
          <span key={i} style={{ position: 'absolute', top: p.top, left: p.left, ...dot(p.color), boxShadow: '0 0 0 4px rgba(255,255,255,0.7)' }} />
        ))}

        <span style={{
          position: 'absolute', bottom: 14, right: 16,
          fontFamily: 'Poppins, sans-serif', fontSize: 11, color: 'var(--land-text-muted)',
        }}>
          Map preview
        </span>
      </div>
    </div>
  )
}

/* ─── Hero section ───
 * Near-total rebuild (Slice 10). The old PhoneMockup component (fake
 * phone frame, hand-drawn SVG map, glow orbs, particle dots — all dark
 * theme) is gone entirely; replaced with the light-minimal spec: a
 * single dotted-route decorative motif, centered copy, and a floating
 * screenshot-style preview card bleeding out of the section's bottom
 * edge. Headline copy is the locked-in copy from the plan's Global
 * Context, verbatim — do not edit without checking there first.
 */
function Hero() {
  const { ref, visible } = useReveal(0.1)
  const fade = (ms) => ({ transitionDelay: `${ms}ms` })

  return (
    <section
      id="about"
      style={{ position: 'relative', overflow: 'visible', background: 'var(--land-bg)', paddingTop: 150 }}
    >
      {/* Decorative route motif — the one explicit "yes, it's a map" cue.
          Confined to its own overflow:hidden layer so it can't visually
          collide with the preview card bleeding past the section below. */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0, pointerEvents: 'none' }}>
        <RouteMotif
          opacity={0.55}
          style={{ position: 'absolute', top: '4%', left: '50%', width: 'min(1000px, 130%)', transform: 'translateX(-50%)' }}
        />
      </div>

      <div ref={ref} style={{ position: 'relative', zIndex: 1, maxWidth: 680, margin: '0 auto', padding: '0 24px', textAlign: 'center' }}>
        {/* Badge */}
        <div
          className={`hero-fade ${visible ? 'visible' : ''}`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            background: 'var(--land-accent-tint-bg)', border: '1px solid var(--land-accent-tint-border)',
            borderRadius: 'var(--land-radius-pill)', padding: '7px 16px', marginBottom: 24,
            ...fade(0),
          }}
        >
          <MapPin size={13} strokeWidth={2.25} color="var(--land-accent)" />
          <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: 13, fontWeight: 500, color: 'var(--land-accent)' }}>
            Built for FUTA
          </span>
        </div>

        {/* Headline — locked copy, verbatim */}
        <h1
          className={`hero-fade ${visible ? 'visible' : ''}`}
          style={{
            fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800,
            fontSize: 'clamp(36px, 6vw, 52px)', lineHeight: 1.14,
            margin: '0 0 20px', color: 'var(--land-text-primary)',
            ...fade(80),
          }}
        >
          Know exactly where you're going{' '}
          <span style={{ color: 'var(--land-accent)' }}>before you get there.</span>
        </h1>

        {/* Subhead — locked copy, verbatim */}
        <p
          className={`hero-fade ${visible ? 'visible' : ''}`}
          style={{
            fontFamily: 'Poppins, sans-serif', fontSize: 17, lineHeight: 1.7,
            color: 'var(--land-text-secondary)', margin: '0 0 32px',
            ...fade(160),
          }}
        >
          Search any building, hostel, or campus service, see a recent photo before you arrive, and follow up-to-date campus directions designed specifically for FUTA — not outdated Google Maps data.
        </p>

        {/* CTA row */}
        <div
          className={`hero-fade ${visible ? 'visible' : ''}`}
          style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginBottom: 20, ...fade(240) }}
        >
          <MapLink
            className="pill-btn"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'var(--land-accent)', color: '#fff', textDecoration: 'none',
              fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: 15,
              padding: '14px 30px', borderRadius: 'var(--land-radius-pill)',
            }}
          >
            <Map size={17} strokeWidth={2} /> Open the Map
          </MapLink>
          <button
            onClick={() => document.getElementById('video')?.scrollIntoView({ behavior: 'smooth' })}
            className="pill-btn"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'var(--land-surface)', color: 'var(--land-text-primary)',
              fontFamily: 'Poppins, sans-serif', fontWeight: 500, fontSize: 15,
              padding: '13px 28px', borderRadius: 'var(--land-radius-pill)',
              border: '1px solid var(--land-border-strong)', cursor: 'pointer',
            }}
          >
            <Play size={14} strokeWidth={2} fill="currentColor" /> See how it works
          </button>
        </div>

        {/* Trust line — locked copy, verbatim */}
        <p
          className={`hero-fade ${visible ? 'visible' : ''}`}
          style={{
            fontFamily: 'Poppins, sans-serif', fontSize: 12, color: 'var(--land-text-muted)',
            margin: 0, ...fade(320),
          }}
        >
          475+ locations mapped · free · no download
        </p>
      </div>

      {/* Floating preview card, bleeding out of the bottom of the section */}
      <div
        className={`hero-fade ${visible ? 'visible' : ''}`}
        style={{ position: 'relative', zIndex: 1, marginTop: 64, padding: '0 24px', ...fade(400) }}
      >
        <div className="-mb-20 md:-mb-28">
          <MapPreviewPlaceholder />
        </div>
      </div>
    </section>
  )
}

export default Hero
