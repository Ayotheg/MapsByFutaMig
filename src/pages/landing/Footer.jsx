import { Link } from 'react-router-dom'
import { Heart, ArrowRight, HeartHandshake, Mail, MapPin, MessageCircle } from 'lucide-react'

const CROWDR_DONATE_URL = 'https://www.oncrowdr.com/explore/c/fund-mapsbyfuta'
const CONTACT_EMAIL = 'gearlifycorporation@gmail.com'
// wa.me click-to-chat API — full international number, no "+" or leading zero.
const WHATSAPP_NUMBER = '2348101734037'

/* ─── Footer ───
 * Light-theme rebuild (Slice 3). Trimmed from the previous 3 link
 * columns (12 links total) + separate CTA column down to 2 short
 * columns, per the redesign plan. Real links preserved throughout
 * (Crowdr donate URL, contact email, /map route). The legal links
 * below originally pointed at "#" because /privacy, /terms, /cookies
 * weren't wired into App.jsx's <Routes> yet even though the page
 * components (PrivacyPolicy.jsx etc.) existed — that routing gap was
 * found and fixed as a bonus while doing this slice (see the plan's
 * "Routing fix (legal pages)" entry), so they now point at the real
 * routes below.
 */
function Footer() {
  return (
    <footer style={{ background: 'var(--land-surface)', borderTop: '0.5px solid var(--land-border)', padding: '56px 24px 32px' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <div className="flex flex-col lg:flex-row gap-10" style={{ paddingBottom: 28, justifyContent: 'space-between' }}>

          {/* Brand */}
          <div style={{ maxWidth: 260 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%',
                background: 'var(--land-accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <MapPin size={14} strokeWidth={2.25} color="#fff" />
              </div>
              <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 15, color: 'var(--land-text-primary)' }}>
                Maps By FUTA
              </span>
            </div>
            <p style={{ fontFamily: 'Poppins, sans-serif', fontSize: 13, lineHeight: 1.6, color: 'var(--land-text-secondary)', margin: 0 }}>
              Your go-to guide on FUTA campus.
            </p>
          </div>

          {/* Link columns */}
          <div className="flex gap-14">
            <div>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: 12, color: 'var(--land-text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>Product</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Link to="/map" style={{ fontFamily: 'Poppins, sans-serif', fontSize: 13, color: 'var(--land-text-secondary)', textDecoration: 'none' }}>Open the map</Link>
                <a href="#features" style={{ fontFamily: 'Poppins, sans-serif', fontSize: 13, color: 'var(--land-text-secondary)', textDecoration: 'none' }}>Features</a>
                <a href="#faq" style={{ fontFamily: 'Poppins, sans-serif', fontSize: 13, color: 'var(--land-text-secondary)', textDecoration: 'none' }}>FAQ</a>
              </div>
            </div>
            <div>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: 12, color: 'var(--land-text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>Legal</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Link to="/privacy" style={{ fontFamily: 'Poppins, sans-serif', fontSize: 13, color: 'var(--land-text-secondary)', textDecoration: 'none' }}>Privacy policy</Link>
                <Link to="/terms" style={{ fontFamily: 'Poppins, sans-serif', fontSize: 13, color: 'var(--land-text-secondary)', textDecoration: 'none' }}>Terms of service</Link>
                <Link to="/cookies" style={{ fontFamily: 'Poppins, sans-serif', fontSize: 13, color: 'var(--land-text-secondary)', textDecoration: 'none' }}>Cookie policy</Link>
              </div>
            </div>
          </div>

          {/* Contact + CTA */}
          <div style={{ maxWidth: 220 }}>
            <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: 12, color: 'var(--land-text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>Get started</div>
            <p style={{ fontFamily: 'Poppins, sans-serif', fontSize: 13, color: 'var(--land-text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
              Free, no download needed.
            </p>
            <Link
              to="/map"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'var(--land-accent)', color: '#fff', textDecoration: 'none',
                borderRadius: 999, padding: '9px 18px',
                fontFamily: 'Poppins, sans-serif', fontSize: 13, fontWeight: 500,
              }}
            >
              Open the map <ArrowRight size={14} strokeWidth={2} />
            </Link>
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: 13, color: 'var(--land-text-secondary)' }}>
                Contact us
              </span>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                aria-label="Email us"
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 30, height: 30, borderRadius: '50%',
                  background: 'var(--land-accent-tint-bg)', color: 'var(--land-accent)',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#e9d9ff' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--land-accent-tint-bg)' }}
              >
                <Mail size={14} strokeWidth={2} />
              </a>
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}`}
                target="_blank"
                rel="noreferrer"
                aria-label="Chat with us on WhatsApp"
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 30, height: 30, borderRadius: '50%',
                  background: 'var(--land-accent-tint-bg)', color: 'var(--land-accent)',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#e9d9ff' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--land-accent-tint-bg)' }}
              >
                <MessageCircle size={14} strokeWidth={2} />
              </a>
            </div>
          </div>
        </div>

        {/* Crowdr support pill — same content/link as before, re-skinned for light mode */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
          <a
            href={CROWDR_DONATE_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="Support Maps By FUTA — donate via Crowdr"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '8px 18px', borderRadius: 999,
              background: 'var(--land-accent-tint-bg)', border: '1px solid var(--land-accent-tint-border)',
              textDecoration: 'none', transition: 'background 0.15s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#e9d9ff' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--land-accent-tint-bg)' }}
          >
            <HeartHandshake size={15} strokeWidth={2} color="var(--land-accent)" />
            <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: 12, color: 'var(--land-text-secondary)' }}>Support us on</span>
            <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 14, color: 'var(--land-text-primary)' }}>Crowdr</span>
          </a>
        </div>

        <div style={{ borderTop: '0.5px solid var(--land-border)', paddingTop: 20, display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontFamily: 'Poppins, sans-serif', fontSize: 12, color: 'var(--land-text-muted)', margin: 0 }}>
            &copy; {new Date().getFullYear()} Maps By FUTA
          </p>
          <p style={{ fontFamily: 'Poppins, sans-serif', fontSize: 12, color: 'var(--land-text-muted)', margin: 0, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            Made with <Heart size={12} strokeWidth={2} fill="currentColor" /> for FUTA
          </p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
