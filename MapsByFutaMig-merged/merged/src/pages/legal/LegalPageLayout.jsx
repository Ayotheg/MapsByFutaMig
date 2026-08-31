import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Logo } from '../landing/shared'

/**
 * Shared shell for /terms-of-service, /privacy-policy, /cookie-policy.
 * Slice 12: relit onto the landing page's light `--land-*` tokens (see
 * src/pages/landing/landing.css) so these read as part of the same
 * light redesign rather than a leftover dark-navy legal template.
 */
function LegalPageLayout({ title, updated, children }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--land-bg)', overflowY: 'auto' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 96px' }}>
        <Link
          to="/"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontFamily: 'Poppins', fontSize: 14, color: 'var(--land-text-secondary)',
            textDecoration: 'none', marginBottom: 32,
          }}
        >
          <ArrowLeft size={16} strokeWidth={2} /> Back to home
        </Link>

        <Logo size={44} />

        <h1 style={{
          fontFamily: "'Bricolage Grotesque'", fontWeight: 800,
          fontSize: 'clamp(28px,4vw,42px)', color: 'var(--land-text-primary)',
          marginTop: 28, marginBottom: 8,
        }}>
          {title}
        </h1>
        {updated && (
          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: 'var(--land-text-muted)', marginBottom: 40 }}>
            Last updated: {updated}
          </p>
        )}

        <div className="legal-content" style={{ fontFamily: 'Poppins', fontSize: 15, lineHeight: 1.85, color: 'var(--land-text-secondary)' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

export default LegalPageLayout
