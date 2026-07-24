import { Link } from 'react-router-dom'
import { Heart, ArrowRight, HeartHandshake, Mail, MessageCircle } from 'lucide-react'
import { Logo } from './shared'

const CROWDR_DONATE_URL = 'https://www.oncrowdr.com/explore/c/fund-mapsbyfuta'
const CONTACT_EMAIL = 'gearlifycorporation@gmail.com'
// wa.me links — international format, no "+", no leading zero.
const WHATSAPP_NUMBERS = [
  { label: 'WhatsApp (Line 1)', number: '2348101734037' },
  { label: 'WhatsApp (Line 2)', number: '2349167746480' },
]
const PRIMARY_WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBERS[0].number}`

/* ─── Footer ─── */
function Footer() {
  // Each Support/Legal item now carries its own destination instead of
  // being a plain label rendered against a shared "#" href.
  const linkGroups = {
    Product: [
      { label: 'About', href: '#about' },
      { label: 'Features', href: '#features' },
      { label: 'Explore the Map', href: '#explore' },
      { label: 'How It Works', href: '#video' },
    ],
    Support: [
      { label: 'Support Us', href: CROWDR_DONATE_URL, external: true },
      { label: 'FAQ', href: '#faq' },
      // Explicit ask: Contact Us should go straight to WhatsApp instead
      // of the old bare "#" (which just scrolled to the top of the page).
      { label: 'Contact Us', href: PRIMARY_WHATSAPP_URL, external: true },
      { label: 'Report an Issue', href: `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Issue report — Maps By FUTA')}` },
    ],
    Legal: [
      { label: 'Privacy Policy', to: '/privacy-policy' },
      { label: 'Terms of Service', to: '/terms-of-service' },
      { label: 'Cookie Policy', to: '/cookie-policy' },
    ],
  }

  const handleAnchorClick = (e, href) => {
    if (href.startsWith('#')) {
      const el = document.getElementById(href.slice(1))
      if (el) {
        e.preventDefault()
        el.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }

  return (
    <footer style={{ background: '#080f1e', borderTop: '1px solid var(--border)', padding: '60px 24px 32px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div className="flex flex-col lg:flex-row gap-12" style={{ marginBottom: 48 }}>
          {/* Brand */}
          <div style={{ flex: 1.5 }}>
            <Logo size={56} />
            <p style={{ fontFamily: 'Poppins', fontSize: 14, lineHeight: 1.75, color: 'var(--muted)', marginTop: 16, maxWidth: 300 }}>
              Your Go-To Guide on FUTA Campus. The intelligent navigation platform built exclusively for the Federal University of Technology, Akure.
            </p>
            <div className="flex gap-3" style={{ marginTop: 20 }}>
              <a href={`mailto:${CONTACT_EMAIL}`} aria-label="Email us" style={{
                width: 40, height: 40, borderRadius: 10, background: 'rgba(34,42,61,0.6)',
                border: '1px solid var(--border)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 14, color: 'var(--muted)',
                textDecoration: 'none', transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(183,109,255,0.4)'; e.currentTarget.style.color = 'var(--text)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}>
                <Mail size={17} strokeWidth={2} />
              </a>
              {WHATSAPP_NUMBERS.map(wa => (
                <a key={wa.number} href={`https://wa.me/${wa.number}`} target="_blank" rel="noreferrer" aria-label={wa.label} title={wa.label} style={{
                  width: 40, height: 40, borderRadius: 10, background: 'rgba(34,42,61,0.6)',
                  border: '1px solid var(--border)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 14, color: 'var(--muted)',
                  textDecoration: 'none', transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(68,226,205,0.5)'; e.currentTarget.style.color = 'var(--text)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}>
                  <MessageCircle size={17} strokeWidth={2} />
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          {Object.entries(linkGroups).map(([section, items]) => (
            <div key={section} style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 13, letterSpacing: 2, color: 'var(--text)', textTransform: 'uppercase', marginBottom: 20 }}>{section}</div>
              {items.map(item => {
                const linkStyle = { display: 'block', fontFamily: 'Poppins', fontSize: 14, color: 'var(--muted)', textDecoration: 'none', marginBottom: 12, transition: 'color 0.2s' }
                const hoverIn = e => (e.currentTarget.style.color = 'var(--text)')
                const hoverOut = e => (e.currentTarget.style.color = 'var(--muted)')

                // Internal route (Legal pages) — use react-router Link.
                if (item.to) {
                  return (
                    <Link key={item.label} to={item.to} style={linkStyle} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
                      {item.label}
                    </Link>
                  )
                }

                // External link (WhatsApp, Crowdr) or same-page anchor
                // (#faq etc.) or mailto — all plain <a> tags.
                return (
                  <a
                    key={item.label}
                    href={item.href}
                    {...(item.external ? { target: '_blank', rel: 'noreferrer' } : {})}
                    onClick={e => handleAnchorClick(e, item.href)}
                    style={linkStyle}
                    onMouseEnter={hoverIn}
                    onMouseLeave={hoverOut}
                  >
                    {item.label}
                  </a>
                )
              })}
            </div>
          ))}

          {/* CTA */}
          <div style={{ flex: 1.2 }}>
            <div style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 13, letterSpacing: 2, color: 'var(--text)', textTransform: 'uppercase', marginBottom: 20 }}>Get Started</div>
            <p style={{ fontFamily: 'Poppins', fontSize: 14, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 20 }}>
              Start navigating FUTA campus today. Free, no download needed.
            </p>
            <Link to="/map" className="btn-primary" style={{ fontSize: 14, padding: '12px 24px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              Open Maps <ArrowRight size={15} strokeWidth={2} />
            </Link>
          </div>
        </div>

        {/* Donation-platform badge — the way large sites quietly surface a
            payment/donation partner mark near the bottom of the footer,
            signalling "you can support us here" without a hard sell.
            Links straight to the live Crowdr campaign. No official Crowdr
            logo file was available in this project, so this is a plain
            icon + wordmark badge rather than their brand mark — drop in
            their SVG here instead if you get one from Crowdr. */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
          <a
            href={CROWDR_DONATE_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="Support Maps By FUTA — donate via Crowdr"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '8px 18px', borderRadius: 999,
              background: 'rgba(183,109,255,0.08)', border: '1px solid rgba(183,109,255,0.25)',
              textDecoration: 'none', transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(183,109,255,0.5)'; e.currentTarget.style.background = 'rgba(183,109,255,0.14)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(183,109,255,0.25)'; e.currentTarget.style.background = 'rgba(183,109,255,0.08)' }}
          >
            <HeartHandshake size={16} strokeWidth={2} color="#b76dff" />
            <span style={{ fontFamily: 'Poppins', fontSize: 12, color: 'var(--muted)' }}>Support us on</span>
            <span style={{ fontFamily: "'Bricolage Grotesque'", fontWeight: 800, fontSize: 15, letterSpacing: -0.3, color: 'var(--text)' }}>Crowdr</span>
          </a>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 24, display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontFamily: 'Poppins', fontSize: 13, color: 'var(--muted)', margin: 0, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            Made with <Heart size={13} strokeWidth={2} fill="currentColor" /> for FUTA
          </p>
          <p style={{ fontFamily: 'Poppins', fontSize: 13, color: 'var(--muted)', margin: 0, opacity: 0.5 }}>
            © {new Date().getFullYear()} Maps By FUTA · All rights reserved
          </p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
