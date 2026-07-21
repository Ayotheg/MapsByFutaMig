import { Link } from 'react-router-dom'
import { Logo } from './shared'

/* ─── Footer ─── */
function Footer() {
  const links = {
    Product: ['About', 'Features', 'Explore the Map', 'How It Works'],
    Support: ['Support Us', 'FAQ', 'Contact Us', 'Report an Issue'],
    Legal: ['Privacy Policy', 'Terms of Service', 'Cookie Policy'],
  }

  return (
    <footer style={{ background: '#080f1e', borderTop: '1px solid var(--border)', padding: '60px 24px 32px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div className="flex flex-col lg:flex-row gap-12" style={{ marginBottom: 48 }}>
          {/* Brand */}
          <div style={{ flex: 1.5 }}>
            <Logo size={40} />
            <p style={{ fontFamily: 'Poppins', fontSize: 14, lineHeight: 1.75, color: 'var(--muted)', marginTop: 16, maxWidth: 300 }}>
              Your Go-To Guide on FUTA Campus. The intelligent navigation platform built exclusively for the Federal University of Technology, Akure.
            </p>
            <div className="flex gap-3" style={{ marginTop: 20 }}>
              {[['𝕏', 'Twitter'], ['in', 'LinkedIn'], ['📸', 'Instagram'], ['💬', 'WhatsApp']].map(([icon, label]) => (
                <a key={label} href="#" aria-label={label} style={{
                  width: 40, height: 40, borderRadius: 10, background: 'rgba(34,42,61,0.6)',
                  border: '1px solid var(--border)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 14, color: 'var(--muted)',
                  textDecoration: 'none', transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(183,109,255,0.4)'; e.currentTarget.style.color = 'var(--text)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}>
                  {icon}
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          {Object.entries(links).map(([section, items]) => (
            <div key={section} style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 13, letterSpacing: 2, color: 'var(--text)', textTransform: 'uppercase', marginBottom: 20 }}>{section}</div>
              {items.map(item => (
                <a key={item} href="#" style={{ display: 'block', fontFamily: 'Poppins', fontSize: 14, color: 'var(--muted)', textDecoration: 'none', marginBottom: 12, transition: 'color 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}>
                  {item}
                </a>
              ))}
            </div>
          ))}

          {/* CTA */}
          <div style={{ flex: 1.2 }}>
            <div style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 13, letterSpacing: 2, color: 'var(--text)', textTransform: 'uppercase', marginBottom: 20 }}>Get Started</div>
            <p style={{ fontFamily: 'Poppins', fontSize: 14, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 20 }}>
              Start navigating FUTA campus today. Free, no download needed.
            </p>
            <Link to="/map" className="btn-primary" style={{ fontSize: 14, padding: '12px 24px' }}>
              Open Maps →
            </Link>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 24, display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontFamily: 'Poppins', fontSize: 13, color: 'rgba(183,109,255,0.5)', margin: 0 }}>
            Made with ❤️ for FUTA
          </p>
          <p style={{ fontFamily: 'Poppins', fontSize: 13, color: 'var(--muted)', margin: 0, opacity: 0.5 }}>
            © {new Date().getFullYear()} Maps By FUTA · All rights reserved
          </p>
          <Link to="/map" style={{ fontFamily: 'Inter', fontSize: 13, color: 'var(--purple-mid)', textDecoration: 'none' }}>
            mapsbyfuta.xyz ↗
          </Link>
        </div>
      </div>
    </footer>
  )
}

export default Footer
