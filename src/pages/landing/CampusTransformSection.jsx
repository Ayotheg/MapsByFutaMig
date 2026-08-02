import { Link } from 'react-router-dom'
import { ArrowRight, ArrowDown, Search } from 'lucide-react'
import { useReveal } from './landingHooks'
import obanlaSignpostImg from '../../assets/OBANLA-CAMPUS_SIGNPOST.jpg'
import obakekereSignpostImg from '../../assets/OBAKEKERE-CAMPUS_SIGNPOST.jpg'
import digitalMapImg from '../../assets/MapssByFuta.jpg'

/* ─── Campus transform (before / after) ───
 * New persuasive section: the pitch made visual rather than argued in
 * prose. "Before" is the two physical signposts that already stand on
 * campus — Obanla and Obakekere, one per side — small and slightly
 * overlapping like two photos dropped on a desk. "After" is a single
 * clean digital map. Same real landmark, same information, but one of
 * them fits in a pocket and can be searched. The arrow between them
 * carries the whole argument; the section deliberately doesn't
 * over-explain it.
 *
 * Placed right after TrustBar, ahead of ProductFeatures — this is the
 * hook that earns the right to list features next, not a feature
 * itself.
 */
function CampusTransformSection() {
  const { ref, visible } = useReveal()

  return (
    <section id="from-signpost" style={{ padding: '120px 24px', background: 'var(--land-surface-alt)' }}>
      <div ref={ref} style={{ maxWidth: 1040, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div
            className={`reveal ${visible ? 'visible' : ''}`}
            style={{
              fontFamily: 'Montserrat, sans-serif', fontSize: 12, fontWeight: 700,
              letterSpacing: 3, color: 'var(--land-secondary-accent)', textTransform: 'uppercase',
              marginBottom: 12,
            }}
          >
            From signpost to search bar
          </div>
          <h2
            className={`reveal ${visible ? 'visible' : ''}`}
            style={{
              fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800,
              fontSize: 'clamp(28px,3.5vw,44px)', color: 'var(--land-text-primary)',
              margin: 0, transitionDelay: '0.1s',
            }}
          >
            We took the campus map off the signpost.
          </h2>
          <p
            className={`reveal ${visible ? 'visible' : ''}`}
            style={{
              fontFamily: 'Poppins, sans-serif', fontSize: 15, lineHeight: 1.6,
              color: 'var(--land-text-secondary)', marginTop: 14, transitionDelay: '0.2s',
              maxWidth: 480, marginLeft: 'auto', marginRight: 'auto',
            }}
          >
            Obanla and Obakekere each have one, fixed to a wall, printed once and never updated. We rebuilt both of them as one map that lives in your pocket and stays current.
          </p>
        </div>

        <div className={`reveal-scale ${visible ? 'visible' : ''} transform-compare`} style={{ transitionDelay: '0.25s' }}>
          {/* Before */}
          <div className="transform-col">
            <span className="transform-badge transform-badge-before">Before</span>
            <div className="before-stack">
              <img src={obanlaSignpostImg} alt="Physical campus map signpost at Obanla campus" className="before-photo before-photo-1" />
              <img src={obakekereSignpostImg} alt="Physical campus map signpost at Obakekere campus" className="before-photo before-photo-2" />
            </div>
            <p className="transform-caption">
              Two signposts, one per campus — useful only if you're already standing in front of one.
            </p>
          </div>

          {/* Connector */}
          <div className="transform-arrow" aria-hidden="true">
            <ArrowRight size={22} strokeWidth={2.25} color="var(--land-accent)" className="transform-arrow-desktop" />
            <ArrowDown size={22} strokeWidth={2.25} color="var(--land-accent)" className="transform-arrow-mobile" />
          </div>

          {/* After */}
          <div className="transform-col">
            <span className="transform-badge transform-badge-after">After</span>
            <div className="after-frame">
              <img src={digitalMapImg} alt="Maps By FUTA digital campus map overview" className="after-photo" />
              <div className="after-chip">
                <Search size={13} strokeWidth={2.25} color="var(--land-accent)" />
                <span>Search FUTA campus…</span>
              </div>
            </div>
            <p className="transform-caption">
              One map, both campuses, searchable from anywhere — and it's never out of date.
            </p>
          </div>
        </div>

        <div
          className={`reveal ${visible ? 'visible' : ''}`}
          style={{ textAlign: 'center', marginTop: 48, transitionDelay: '0.35s' }}
        >
          <Link
            to="/map"
            className="pill-btn"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'var(--land-accent)', color: '#fff', textDecoration: 'none',
              fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: 15,
              padding: '14px 30px', borderRadius: 'var(--land-radius-pill)',
            }}
          >
            Try the digital map <ArrowRight size={16} strokeWidth={2.25} />
          </Link>
        </div>
      </div>
    </section>
  )
}

export default CampusTransformSection
