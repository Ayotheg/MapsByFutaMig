import { MapPin, ArrowRight } from 'lucide-react'
import { useReveal } from './landingHooks'
import { MapLink } from './shared'
import tiFrancisImg from '../../assets/TI_FRANCIS.jpg'
import slsImg from '../../assets/SLS.jpg'
import senateImg from '../../assets/SENATE_BUILDING.jpg'
import libraryImg from '../../assets/ALBERT-ILEMOBADE LIBRARY.jpg'

/* ─── Popular places ───
 * New section, sits right after ExploreSection's category grid. Where
 * Explore answers "what kind of place am I looking for", this answers
 * "what does campus actually look like" — four real building photos a
 * first-timer will recognize on sight, so the map feels grounded in
 * the real campus rather than an abstract pin-drop tool.
 *
 * Visual treatment: a fanned stack (four cards splayed at increasing
 * angles either side of center, like a hand of playing cards laid on
 * its side — the "sideways V" from the brief) rather than a plain
 * grid, so it reads as a distinct, memorable beat rather than another
 * uniform card row. Hovering/focusing a card straightens and lifts it
 * above its neighbors; everything else about the card language
 * (radius, border, shadow) matches the rest of the page. Below
 * `--popular-fan-collapse-bp` (landing.css) the fan flattens into a
 * plain horizontal scroll-snap row — the angled layout only works
 * with room to spread out sideways.
 */
const PLACES = [
  { key: 'ti-francis', name: 'T.I. Francis Building', img: tiFrancisImg },
  { key: 'sls', name: 'SLS Building', img: slsImg },
  { key: 'senate', name: 'Senate Building', img: senateImg },
  { key: 'library', name: 'Albert Ilemobade Library', img: libraryImg },
]

function PopularPlacesSection() {
  const { ref, visible } = useReveal()

  return (
    <section id="popular-places" style={{ padding: '120px 24px 140px', background: 'var(--land-bg)' }}>
      <div ref={ref} style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div
            className={`reveal ${visible ? 'visible' : ''}`}
            style={{
              fontFamily: 'Montserrat, sans-serif', fontSize: 12, fontWeight: 700,
              letterSpacing: 3, color: 'var(--land-accent)', textTransform: 'uppercase',
              marginBottom: 12,
            }}
          >
            Popular on campus
          </div>
          <h2
            className={`reveal ${visible ? 'visible' : ''}`}
            style={{
              fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800,
              fontSize: 'clamp(28px,3.5vw,44px)', color: 'var(--land-text-primary)',
              margin: 0, transitionDelay: '0.1s',
            }}
          >
            Buildings every fresher learns fast.
          </h2>
          <p
            className={`reveal ${visible ? 'visible' : ''}`}
            style={{
              fontFamily: 'Poppins, sans-serif', fontSize: 15, lineHeight: 1.6,
              color: 'var(--land-text-secondary)', marginTop: 14, transitionDelay: '0.2s',
              maxWidth: 480, marginLeft: 'auto', marginRight: 'auto',
            }}
          >
            Real photos of the spots you'll actually be asked to find — so you recognize them the moment you arrive, not after three wrong turns.
          </p>
        </div>

        <div
          className={`reveal-scale ${visible ? 'visible' : ''} popular-fan`}
          style={{ transitionDelay: '0.25s' }}
        >
          {PLACES.map((place, i) => (
            <MapLink
              key={place.key}
              className={`popular-card popular-card-${i}`}
              style={{ backgroundImage: `url(${place.img})` }}
            >
              <span className="popular-card-scrim" aria-hidden="true" />
              <span className="popular-card-label">
                <MapPin size={13} strokeWidth={2.25} color="#fff" style={{ flexShrink: 0 }} />
                {place.name}
              </span>
            </MapLink>
          ))}
        </div>

        <div
          className={`reveal ${visible ? 'visible' : ''}`}
          style={{ textAlign: 'center', marginTop: 40, transitionDelay: '0.35s' }}
        >
          <MapLink
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: 14,
              color: 'var(--land-accent)', textDecoration: 'none',
            }}
          >
            See every location on the map <ArrowRight size={15} strokeWidth={2.25} />
          </MapLink>
        </div>
      </div>
    </section>
  )
}

export default PopularPlacesSection
