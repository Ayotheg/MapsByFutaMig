import { useState } from 'react'
import { ArrowUpRight } from 'lucide-react'

const DONATE_URL = 'https://buymeamalt.com/@ayotheg'

/**
 * Live preview of the Buy Me a Malt page, as a plain <iframe> sized to sit
 * inside SupportSection's glass card. Built as its own file so it's
 * swappable later without touching the rest of SupportSection.
 *
 * Buy Me a Malt sends no X-Frame-Options or CSP frame-ancestors header
 * (checked Oct 2026), so it can be framed. The link under it stays anyway,
 * in case that changes: a blocked frame just renders blank and doesn't
 * reliably fire an error to detect.
 */
function DonateCard({ donateUrl = DONATE_URL }) {
  const [loaded, setLoaded] = useState(false)

  return (
    <div style={{ width: '100%', maxWidth: 480, margin: '0 auto 32px' }}>
      <div style={{
        position: 'relative', borderRadius: 20, overflow: 'hidden',
        border: '1px solid rgba(68,226,205,0.3)',
        background: '#fff',
        boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
      }}>
        {!loaded && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(11,19,38,0.9)', zIndex: 1,
          }}>
            <div className="animate-spin-fast" style={{
              width: 28, height: 28, borderRadius: '50%',
              border: '3px solid rgba(68,226,205,0.25)', borderTopColor: '#44e2cd',
            }} />
          </div>
        )}
        <iframe
          src={donateUrl}
          title="Support Maps By FUTA — Buy Me a Malt"
          onLoad={() => setLoaded(true)}
          loading="lazy"
          style={{ display: 'block', width: '100%', height: 480, border: 'none' }}
        />
      </div>

      <a
        href={donateUrl}
        target="_blank"
        rel="noreferrer"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          marginTop: 10, fontFamily: 'Inter', fontSize: 12.5, color: 'var(--muted)',
          textDecoration: 'none',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--teal)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
      >
        Trouble viewing it? Open Buy Me a Malt <ArrowUpRight size={13} strokeWidth={2} />
      </a>
    </div>
  )
}

export default DonateCard
