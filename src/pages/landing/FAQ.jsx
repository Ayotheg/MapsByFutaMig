import { useState } from 'react'
import { useReveal } from './landingHooks'

/* ─── FAQ ─── */
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
    <section id="faq" style={{ padding: '120px 24px', background: 'var(--bg-darkest)' }}>
      <div ref={ref} style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 60 }}>
          <div className={`reveal ${visible ? 'visible' : ''}`} style={{ fontFamily: 'Montserrat', fontSize: 12, fontWeight: 700, letterSpacing: 4, color: 'var(--teal)', textTransform: 'uppercase', marginBottom: 12 }}>FAQ</div>
          <h2 className={`reveal ${visible ? 'visible' : ''}`} style={{ fontFamily: "'Bricolage Grotesque'", fontSize: 'clamp(28px,3.5vw,46px)', fontWeight: 800, transitionDelay: '0.1s' }}>
            Frequently Asked <span className="text-gradient-purple">Questions.</span>
          </h2>
        </div>

        <div className={`reveal ${visible ? 'visible' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: 12, transitionDelay: '0.15s' }}>
          {faqs.map((faq, i) => (
            <div key={i} style={{
              background: 'rgba(34,42,61,0.5)', border: `1px solid ${openIdx === i ? 'rgba(183,109,255,0.4)' : 'rgba(77,67,84,0.5)'}`,
              borderRadius: 16, overflow: 'hidden', transition: 'border-color 0.2s',
            }}>
              <button onClick={() => setOpenIdx(openIdx === i ? null : i)} style={{
                width: '100%', textAlign: 'left', padding: '20px 24px', background: 'none', border: 'none',
                cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontFamily: 'Montserrat', fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>{faq.q}</span>
                <span style={{ color: 'var(--purple-light)', fontSize: 18, transition: 'transform 0.3s', transform: openIdx === i ? 'rotate(45deg)' : 'rotate(0deg)', flexShrink: 0 }}>+</span>
              </button>
              {openIdx === i && (
                <div style={{ padding: '0 24px 20px' }}>
                  <p style={{ fontFamily: 'Poppins', fontSize: 14, lineHeight: 1.75, color: 'var(--muted)', margin: 0 }}>{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default FAQ
