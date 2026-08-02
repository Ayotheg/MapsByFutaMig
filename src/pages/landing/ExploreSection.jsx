import { Plus } from 'lucide-react'
import { useReveal } from './landingHooks'
import { LEGACY_ICON_MAP } from '../../lib/legacyIconMap'
import { MapLink } from './shared'

/* ─── Explore categories ───
 * Light-theme rebuild (Slice 5). Content change, not just a style
 * change: swapped the old 20-item generic category grid for the 9
 * most-visited student spots the plan calls out, in the specified
 * order, plus a "+ more" tile linking into the map's full category
 * list. Church and mosque are both included, side by side,
 * deliberately even — see LANDING_PAGE_REDESIGN_PLAN.md Slice 5.
 *
 * Icons come from the existing LEGACY_ICON_MAP (src/lib/legacyIconMap.js)
 * rather than guessed ad hoc — 'mosque' already resolves to a
 * hand-drawn custom SVG there (no confirmed Lucide equivalent, per that
 * file's own notes), so it drops in exactly like every other entry.
 */
const CATEGORIES = [
  { label: 'Faculties', icon: 'building-fill' },
  { label: 'Lecture Halls', icon: 'graduation-cap' },
  { label: 'Hostels', icon: 'house-door-fill' },
  { label: 'Library', icon: 'book-open' },
  { label: 'ATMs & Banks', icon: 'bank2' },
  { label: 'Printing Shops', icon: 'printer-fill' },
  { label: 'Student Affairs', icon: 'briefcase' },
  { label: 'Church', icon: 'church' },
  { label: 'Mosque', icon: 'mosque' },
]

function ExploreSection() {
  const { ref, visible } = useReveal()

  return (
    <section
      id="explore"
      style={{ padding: '120px 24px', background: 'var(--land-bg)' }}
    >
      <div ref={ref} style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div
            className={`reveal ${visible ? 'visible' : ''}`}
            style={{
              fontFamily: 'Montserrat, sans-serif', fontSize: 12, fontWeight: 700,
              letterSpacing: 3, color: 'var(--land-secondary-accent)',
              textTransform: 'uppercase', marginBottom: 12,
            }}
          >
            Explore
          </div>
          <h2
            className={`reveal ${visible ? 'visible' : ''}`}
            style={{
              fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800,
              fontSize: 'clamp(28px,3.5vw,44px)', color: 'var(--land-text-primary)',
              transitionDelay: '0.1s', margin: 0,
            }}
          >
            The places students visit most.
          </h2>
          <p
            className={`reveal ${visible ? 'visible' : ''}`}
            style={{
              fontFamily: 'Poppins, sans-serif', fontSize: 15, lineHeight: 1.6,
              color: 'var(--land-text-secondary)', marginTop: 14, transitionDelay: '0.2s',
            }}
          >
            The spots every student ends up needing directions to, sooner or later.
          </p>
        </div>

        <div
          className={`reveal ${visible ? 'visible' : ''}`}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: 14,
            transitionDelay: '0.2s',
          }}
        >
          {CATEGORIES.map((cat) => {
            const Icon = LEGACY_ICON_MAP[cat.icon]
            return (
              <MapLink
                key={cat.label}
                className="explore-tile"
                style={{
                  background: 'var(--land-surface)',
                  border: '1px solid var(--land-border)',
                  borderRadius: 14,
                  padding: '22px 16px',
                  textAlign: 'center',
                  textDecoration: 'none',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: 'var(--land-secondary-tint-bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {Icon && <Icon size={19} strokeWidth={2} color="var(--land-secondary-accent)" />}
                </div>
                <span style={{
                  fontFamily: 'Poppins, sans-serif', fontSize: 13, fontWeight: 500,
                  color: 'var(--land-text-primary)', lineHeight: 1.3,
                }}>
                  {cat.label}
                </span>
              </MapLink>
            )
          })}

          {/* "+ more" — violet, not teal: a link out, not a category */}
          <MapLink
            className="explore-tile explore-tile-more"
            style={{
              background: 'var(--land-surface)',
              border: '1px solid var(--land-border)',
              borderRadius: 14,
              padding: '22px 16px',
              textAlign: 'center',
              textDecoration: 'none',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'var(--land-accent-tint-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Plus size={19} strokeWidth={2} color="var(--land-accent)" />
            </div>
            <span style={{
              fontFamily: 'Poppins, sans-serif', fontSize: 13, fontWeight: 500,
              color: 'var(--land-accent)', lineHeight: 1.3,
            }}>
              + more on the map
            </span>
          </MapLink>
        </div>
      </div>
    </section>
  )
}

export default ExploreSection
