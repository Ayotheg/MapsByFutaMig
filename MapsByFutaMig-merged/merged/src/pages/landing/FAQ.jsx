import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useReveal } from './landingHooks'

/* ─── FAQ ───
 * Light-theme rebuild (Slice 6). Content kept as-is — none of these
 * five items reference a deleted section (Discover/Roadmap/Stats/Why),
 * so no rewrite was needed there, per the plan's acceptance check.
 * Only the accordion chrome changed: white cards, hairline borders,
 * violet accent limited to the expanded item's icon/indicator rather
 * than the whole card.
 */
function FAQ() {
  const { ref, visible } = useReveal()
  const [openIdx, setOpenIdx] = useState(null)
  const faqs = [
    { q: 'What is Maps By FUTA?', a: 'Maps By FUTA is an interactive campus navigation platform built exclusively for the Federal University of Technology, Akure. It helps students, staff, freshers, parents, and visitors navigate the campus using intelligent search, live GPS navigation, and categorized location discovery.' },
    { q: 'Do I need to download an app?', a: 'No. Maps By FUTA is a Progressive Web App (PWA) — it runs entirely in your browser. Just visit mapsbyfuta.xyz on any device and start navigating immediately.' },
    { q: 'Is Maps By FUTA free to use?', a: 'Yes! Maps By FUTA is completely free for all students, staff, and visitors. It will always be free. Community support helps keep it that way.' },
    { q: 'How accurate is the campus map?', a: 'The map is built specifically for FUTA campus using accurate geographic data with 475+ verified locations. The team continuously updates the map as campus changes.' },
    { q: 'Can I use Maps By FUTA without internet?', a: "Currently Maps By FUTA requires an internet connection. Offline mode is on the roadmap and will be coming soon." },
  ]

  return (
    <section id="faq" style={{ padding: '120px 24px', background: 'var(--land-surface-alt)' }}>
      <div ref={ref} style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <div
            className={`reveal ${visible ? 'visible' : ''}`}
            style={{
              fontFamily: 'Montserrat, sans-serif', fontSize: 12, fontWeight: 700,
              letterSpacing: 3, color: 'var(--land-accent)', textTransform: 'uppercase', marginBottom: 12,
            }}
          >
            FAQ
          </div>
          <h2
            className={`reveal ${visible ? 'visible' : ''}`}
            style={{
              fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800,
              fontSize: 'clamp(28px,3.5vw,44px)', color: 'var(--land-text-primary)',
              transitionDelay: '0.1s', margin: 0,
            }}
          >
            Frequently asked questions.
          </h2>
        </div>

        <div className={`reveal ${visible ? 'visible' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: 12, transitionDelay: '0.15s' }}>
          {faqs.map((faq, i) => {
            const open = openIdx === i
            return (
              <div
                key={i}
                style={{
                  background: 'var(--land-surface)',
                  border: `1px solid ${open ? 'var(--land-accent-tint-border)' : 'var(--land-border)'}`,
                  borderRadius: 16, overflow: 'hidden', transition: 'border-color 0.2s',
                }}
              >
                <button
                  onClick={() => setOpenIdx(open ? null : i)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '20px 24px', background: 'none', border: 'none',
                    cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16,
                  }}
                >
                  <span style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: 15, color: 'var(--land-text-primary)' }}>
                    {faq.q}
                  </span>
                  <span style={{
                    flexShrink: 0, width: 26, height: 26, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: open ? 'var(--land-accent-tint-bg)' : 'transparent',
                    transition: 'transform 0.3s, background 0.2s',
                    transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
                  }}>
                    <Plus size={15} strokeWidth={2.25} color={open ? 'var(--land-accent)' : 'var(--land-text-muted)'} />
                  </span>
                </button>
                {open && (
                  <div style={{ padding: '0 24px 20px' }}>
                    <p style={{ fontFamily: 'Poppins, sans-serif', fontSize: 14, lineHeight: 1.75, color: 'var(--land-text-secondary)', margin: 0 }}>
                      {faq.a}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default FAQ
