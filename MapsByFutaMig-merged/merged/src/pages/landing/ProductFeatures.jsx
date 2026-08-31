import { Camera, Search, Compass, ArrowRight } from 'lucide-react'
import { useReveal } from './landingHooks'

/* ─── Product features ───
 * Light-theme rebuild (Slice 8). Not a retheme — a rewrite. The old
 * file was 260 lines: 5 alternating left/right blocks, each with a
 * hand-drawn dark-theme SVG "visual" mockup, contributing heavily to
 * the "endless list" complaint on this page. Both changes the plan
 * calls for are done here:
 *
 * 1. Trimmed from 5 features to the 3 that actually differentiate the
 *    product. The recent-photo + up-to-date-routes angle from the
 *    Hero subhead now gets its own card here instead of being
 *    Hero-only — Community Reviews and Mobile First were cut as the
 *    two least differentiating (reviews/PWA-support are common to any
 *    map app; the recent-photo/fresh-routes/live-search/live-nav trio
 *    is what's actually FUTA-specific).
 * 2. Replaced every bespoke SVG mockup with the same light card
 *    language established in Slice 5's Explore tiles (white bg,
 *    hairline border, rounded, icon chip) — a simple icon-led card
 *    instead of 5 different illustrations re-themed pixel-for-pixel.
 */
const FEATURES = [
  {
    Icon: Camera,
    title: 'See it before you arrive',
    tagline: 'Every location shows a recent photo, so you recognize it the moment you get there — not a guess based on a pin on a map.',
    bullets: ['Recent photo per location', 'Routes newer than 6-year-stale Google Maps data'],
  },
  {
    Icon: Search,
    title: 'Find anything in seconds',
    tagline: 'Search any building, hostel, or service by name and get instant, distance-aware results across 475+ mapped locations.',
    bullets: ['Instant autocomplete', 'Distance-aware results'],
  },
  {
    Icon: Compass,
    title: 'Directions built for FUTA',
    tagline: 'Walking or driving, get turn-by-turn routes with live GPS tracking and ETA — designed around how people actually move on this campus.',
    bullets: ['Walking & driving routes', 'Live GPS tracking & ETA'],
  },
]

function FeatureCard({ Icon, title, tagline, bullets, index }) {
  const { ref, visible } = useReveal()
  return (
    <div
      ref={ref}
      className={`reveal feature-tile ${visible ? 'visible' : ''}`}
      style={{
        background: 'var(--land-surface)', border: '1px solid var(--land-border)',
        borderRadius: 'var(--land-radius-card)', padding: '32px 28px',
        transitionDelay: `${0.08 * index}s`,
      }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: 'var(--land-accent-tint-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 20,
      }}>
        <Icon size={21} strokeWidth={2} color="var(--land-accent)" />
      </div>
      <h3 style={{
        fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800,
        fontSize: 20, color: 'var(--land-text-primary)', margin: '0 0 10px',
      }}>
        {title}
      </h3>
      <p style={{
        fontFamily: 'Poppins, sans-serif', fontSize: 14, lineHeight: 1.65,
        color: 'var(--land-text-secondary)', margin: '0 0 18px',
      }}>
        {tagline}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {bullets.map((b) => (
          <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ArrowRight size={13} strokeWidth={2.25} color="var(--land-accent)" style={{ flexShrink: 0 }} />
            <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: 13, color: 'var(--land-text-primary)' }}>{b}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ProductFeatures() {
  const { ref, visible } = useReveal()

  return (
    <section id="features" style={{ padding: '120px 24px', background: 'var(--land-bg)' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <div ref={ref} style={{ textAlign: 'center', marginBottom: 64 }}>
          <div
            className={`reveal ${visible ? 'visible' : ''}`}
            style={{
              fontFamily: 'Montserrat, sans-serif', fontSize: 12, fontWeight: 700,
              letterSpacing: 3, color: 'var(--land-accent)', textTransform: 'uppercase',
              marginBottom: 12,
            }}
          >
            Product
          </div>
          <h2
            className={`reveal ${visible ? 'visible' : ''}`}
            style={{
              fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800,
              fontSize: 'clamp(28px,3.5vw,46px)', color: 'var(--land-text-primary)',
              margin: 0, transitionDelay: '0.1s',
            }}
          >
            Everything you need to navigate FUTA.
          </h2>
        </div>

        <div
          style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 20,
          }}
        >
          {FEATURES.map((f, i) => (
            <FeatureCard key={f.title} index={i} {...f} />
          ))}
        </div>
      </div>
    </section>
  )
}

export default ProductFeatures
