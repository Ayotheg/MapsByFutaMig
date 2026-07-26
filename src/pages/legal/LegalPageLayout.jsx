import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Logo } from '../landing/shared'

/**
 * Shared shell for /terms-of-service, /privacy-policy, /cookie-policy.
 * Reuses the landing page's dark-navy / violet design tokens (see
 * src/styles/tokens.css + src/pages/landing/landing.css) so these read
 * as part of the same product rather than a bolted-on legal template.
 */
function LegalPageLayout({ title, updated, children }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-darkest, #0b1326)', overflowY: 'auto' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 96px' }}>
        <Link
          to="/"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontFamily: 'Poppins', fontSize: 14, color: 'var(--muted)',
            textDecoration: 'none', marginBottom: 32,
          }}
        >
          <ArrowLeft size={16} strokeWidth={2} /> Back to home
        </Link>

        <Logo size={44} />

        <h1 style={{
          fontFamily: "'Bricolage Grotesque'", fontWeight: 800,
          fontSize: 'clamp(28px,4vw,42px)', color: 'var(--text)',
          marginTop: 28, marginBottom: 8,
        }}>
          {title}
        </h1>
        {updated && (
          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: 'var(--muted)', marginBottom: 40 }}>
            Last updated: {updated}
          </p>
        )}

        <div className="legal-content" style={{ fontFamily: 'Poppins', fontSize: 15, lineHeight: 1.85, color: 'var(--text-variant)' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

export default LegalPageLayout
