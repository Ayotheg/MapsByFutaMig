import { ArrowRight, Search, Signpost } from 'lucide-react'
import { useReveal } from './landingHooks'
import { Logo, MapLink } from './shared'

/* ─── Signpost vs. digital map ───
 * Rebuilt from screenshots of the live site — this section wasn't in
 * the codebase export the project was built from, only on the
 * deployed page. The two "signpost" photos on the Before side are
 * clearly-labeled placeholders (same policy Hero.jsx already uses for
 * its map-preview mockup, see the note at the top of that file): swap
 * each PhotoPlaceholder below for a real <img> of the two physical
 * campus signposts once available — nothing else about the layout
 * needs to change.
 */
function PhotoPlaceholder({ label, rotate, style }) {
  return (
    <div
      style={{
        position: 'absolute', width: 200, aspectRatio: '4 / 3',
        background: 'linear-gradient(145deg, var(--land-surface-alt), #ece3fb)',
        border: '6px solid #fff', borderRadius: 8,
        boxShadow: '0 16px 34px rgba(20,10,40,0.14)',
        transform: `rotate(${rotate}deg)`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
        ...style,
      }}
    >
      <Signpost size={24} strokeWidth={1.75} color="var(--land-text-muted)" />
      <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: 11, color: 'var(--land-text-muted)', textAlign: 'center', padding: '0 14px' }}>
        {label}
      </span>
    </div>
  )
}

function BeforeAfterSection() {
  const { ref, visible } = useReveal(0.15)

  return (
    <section style={{ padding: 'clamp(72px, 10vw, 120px) 24px', background: 'var(--land-surface-alt)' }}>
      <div ref={ref} className={`reveal ${visible ? 'visible' : ''}`} style={{ maxWidth: 1080, margin: '0 auto' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-start', gap: 40 }}>

          {/* Before */}
          <div style={{ flex: '1 1 300px', maxWidth: 360, textAlign: 'center' }}>
            <span style={{
              display: 'inline-block', fontFamily: 'Montserrat, sans-serif', fontSize: 12, fontWeight: 700,
              letterSpacing: 2, color: 'var(--land-text-secondary)', textTransform: 'uppercase',
              background: '#fff', border: '1px solid var(--land-border)', borderRadius: 999,
              padding: '6px 18px', marginBottom: 40,
            }}>
              Before
            </span>
            <div style={{ position: 'relative', height: 200, margin: '0 auto', maxWidth: 240 }}>
              <PhotoPlaceholder label="Signpost — Campus A" rotate={-6} style={{ left: 0, top: 8 }} />
              <PhotoPlaceholder label="Signpost — Campus B" rotate={4} style={{ left: 40, top: 0 }} />
            </div>
            <p style={{ fontFamily: 'Poppins, sans-serif', fontSize: 14, lineHeight: 1.7, color: 'var(--land-text-secondary)', marginTop: 24 }}>
              Two signposts, one per campus — useful only if you're already standing in front of one.
            </p>
          </div>

          {/* Arrow */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 96 }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'var(--land-accent-tint-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ArrowRight size={19} strokeWidth={2.25} color="var(--land-accent)" />
            </div>
          </div>

          {/* After */}
          <div style={{ flex: '1 1 300px', maxWidth: 360, textAlign: 'center' }}>
            <span style={{
              display: 'inline-block', fontFamily: 'Montserrat, sans-serif', fontSize: 12, fontWeight: 700,
              letterSpacing: 2, color: 'var(--land-accent)', textTransform: 'uppercase',
              background: 'var(--land-accent-tint-bg)', border: '1px solid var(--land-accent-tint-border)', borderRadius: 999,
              padding: '6px 18px', marginBottom: 40,
            }}>
              After
            </span>
            <div style={{
              background: '#fff', borderRadius: 20, padding: '32px 26px',
              boxShadow: '0 20px 50px rgba(20,10,40,0.10)', border: '1px solid var(--land-border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 22 }}>
                <Logo size={40} />
                <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 22, color: 'var(--land-text-primary)' }}>
                  MapsByFuta
                </span>
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'var(--land-surface-alt)', border: '1px solid var(--land-border)',
                borderRadius: 999, padding: '11px 16px',
              }}>
                <Search size={15} strokeWidth={2} color="var(--land-text-muted)" />
                <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: 13, color: 'var(--land-text-muted)' }}>Search FUTA campus…</span>
              </div>
            </div>
            <p style={{ fontFamily: 'Poppins, sans-serif', fontSize: 14, lineHeight: 1.7, color: 'var(--land-text-secondary)', marginTop: 24 }}>
              One map, both campuses, searchable from anywhere — and it's never out of date.
            </p>
          </div>
        </div>

        {/* Same MapLink used everywhere else — dimmed/inert pre-launch,
            live once LAUNCH_DATE passes, same as every other /map CTA. */}
        <div style={{ textAlign: 'center', marginTop: 56 }}>
          <MapLink
            className="pill-btn"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'var(--land-accent)', color: '#fff', textDecoration: 'none',
              fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: 15,
              padding: '14px 30px', borderRadius: 'var(--land-radius-pill)',
            }}
          >
            Try the digital map <ArrowRight size={16} strokeWidth={2} />
          </MapLink>
        </div>
      </div>
    </section>
  )
}

export default BeforeAfterSection
