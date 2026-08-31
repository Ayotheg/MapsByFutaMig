import { MapPin, Camera } from 'lucide-react'
import { useReveal } from './landingHooks'

/* ─── Buildings every fresher learns fast ───
 * Also rebuilt from a screenshot of the live site — not present in the
 * original codebase export. The four cards are clearly-labeled photo
 * placeholders (same "don't fake it" policy as Hero's map-preview
 * mockup and BeforeAfterSection's signposts): swap each PhotoCard's
 * placeholder graphic for a real <img> of that building once photos
 * are available — labels, order, and layout don't need to change.
 */
const BUILDINGS = [
  { name: 'T.I. Francis' },
  { name: 'SLS Building' },
  { name: 'Senate Building' },
  { name: 'Albert Ilemobade Library' },
]

function PhotoCard({ name, rotate, marginLeft, z }) {
  return (
    <div style={{
      position: 'relative', width: 'clamp(130px, 20vw, 210px)', aspectRatio: '3 / 4',
      borderRadius: 14, overflow: 'hidden', flexShrink: 0,
      border: '6px solid #fff', boxShadow: '0 20px 40px rgba(20,10,40,0.14)',
      background: 'linear-gradient(160deg, #d9d2ea, #b9aed6)',
      transform: `rotate(${rotate}deg)`, marginLeft, zIndex: z,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      <Camera size={24} strokeWidth={1.75} color="rgba(255,255,255,0.85)" />
      <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 8 }}>
        Photo placeholder
      </span>
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, padding: '30px 12px 12px',
        background: 'linear-gradient(0deg, rgba(0,0,0,0.55), transparent)',
        display: 'flex', alignItems: 'center', gap: 5,
      }}>
        <MapPin size={13} strokeWidth={2.25} color="#fff" style={{ flexShrink: 0 }} />
        <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: 12, fontWeight: 600, color: '#fff', lineHeight: 1.3 }}>
          {name}
        </span>
      </div>
    </div>
  )
}

function FresherBuildingsSection() {
  const { ref, visible } = useReveal(0.15)

  return (
    <section style={{ padding: 'clamp(72px, 10vw, 120px) 24px', background: 'var(--land-bg)', overflow: 'hidden' }}>
      <div ref={ref} className={`reveal ${visible ? 'visible' : ''}`} style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{
          fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800,
          fontSize: 'clamp(28px,4vw,44px)', color: 'var(--land-text-primary)', margin: 0,
        }}>
          Buildings every fresher learns fast.
        </h2>
        <p style={{
          fontFamily: 'Poppins, sans-serif', fontSize: 15, lineHeight: 1.7,
          color: 'var(--land-text-secondary)', maxWidth: 560, margin: '18px auto 0',
        }}>
          Real photos of the spots you'll actually be asked to find — so you recognize them the moment you arrive, not after three wrong turns.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 64, flexWrap: 'nowrap' }}>
          {BUILDINGS.map((b, i) => (
            <PhotoCard
              key={b.name}
              name={b.name}
              rotate={(i - 1.5) * 5}
              marginLeft={i === 0 ? 0 : 'clamp(-50px, -8vw, -30px)'}
              z={i}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

export default FresherBuildingsSection
