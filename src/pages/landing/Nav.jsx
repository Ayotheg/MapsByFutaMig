import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { X, Menu, MapPin } from 'lucide-react'

/* ─── Navigation ───
 * Floating light-theme pill nav for the marketing landing page. This is
 * scoped to "/" only — the in-app map tool (src/pages/MapPage.jsx) keeps
 * its own separate dark-theme header untouched.
 */
function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  // Every id here must exist on a real section post-redesign:
  // Hero -> #about, ProductFeatures -> #features, VideoSection -> #video,
  // ExploreSection -> #explore, FAQ -> #faq.
  const links = [
    { label: 'Features', id: 'features' },
    { label: 'See how it works', id: 'video' },
    { label: 'Explore', id: 'explore' },
    { label: 'FAQ', id: 'faq' },
  ]

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setMobileOpen(false)
  }

  return (
    <nav
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        transition: 'all 0.3s ease',
        display: 'flex', justifyContent: 'center',
        padding: scrolled ? '16px 20px 0' : '20px 24px 0',
      }}
    >
      <div
        className="grid items-center"
        style={{
          width: '100%', maxWidth: 1120,
          height: 64,
          padding: '0 20px',
          gridTemplateColumns: '1fr auto 1fr',
          background: 'var(--land-surface)',
          border: '0.5px solid var(--land-border)',
          borderRadius: 999,
          boxShadow: scrolled ? '0 4px 24px rgba(0,0,0,0.06)' : 'none',
          transition: 'box-shadow 0.3s ease',
        }}
      >
        {/* Logo */}
        <Link
          to="/"
          style={{ justifySelf: 'start', display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
        >
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'var(--land-accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <MapPin size={15} strokeWidth={2.25} color="#fff" />
          </div>
          <span style={{
            fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800,
            fontSize: 15, color: 'var(--land-text-primary)', whiteSpace: 'nowrap',
          }}>
            Maps By FUTA
          </span>
        </Link>

        {/* Desktop links */}
        <div
          className="hidden md:flex items-center gap-7"
          style={{ justifySelf: 'center', gridColumn: 2 }}
        >
          {links.map(l => (
            <button
              key={l.id}
              onClick={() => scrollTo(l.id)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'Poppins, sans-serif', fontSize: 13, fontWeight: 500,
                color: 'var(--land-text-secondary)', whiteSpace: 'nowrap',
              }}
            >
              {l.label}
            </button>
          ))}
        </div>

        {/* CTA + mobile toggle */}
        <div className="flex items-center gap-3" style={{ justifySelf: 'end', gridColumn: 3 }}>
          <Link
            to="/map"
            className="hidden md:inline-flex"
            style={{
              alignItems: 'center', gap: 6,
              background: 'var(--land-accent)', color: '#fff', textDecoration: 'none',
              borderRadius: 999, padding: '9px 18px',
              fontFamily: 'Poppins, sans-serif', fontSize: 13, fontWeight: 500,
              transition: 'transform 0.15s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px) scale(1.03)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none' }}
          >
            Open the map
          </Link>
          <button
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--land-text-primary)', display: 'flex', alignItems: 'center' }}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <X size={20} strokeWidth={2} /> : <Menu size={20} strokeWidth={2} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div
          className="md:hidden"
          style={{
            position: 'absolute', top: 76, left: 20, right: 20,
            background: 'var(--land-surface)', border: '0.5px solid var(--land-border)',
            borderRadius: 16, padding: '12px 0',
            boxShadow: '0 12px 32px rgba(0,0,0,0.08)',
          }}
        >
          {links.map(l => (
            <button
              key={l.id}
              onClick={() => scrollTo(l.id)}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '12px 24px',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--land-text-primary)', fontFamily: 'Poppins, sans-serif', fontSize: 14,
              }}
            >
              {l.label}
            </button>
          ))}
          <div style={{ padding: '8px 24px 4px' }}>
            <Link
              to="/map"
              style={{
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                background: 'var(--land-accent)', color: '#fff', textDecoration: 'none',
                borderRadius: 999, padding: '11px 0',
                fontFamily: 'Poppins, sans-serif', fontSize: 14, fontWeight: 500,
              }}
            >
              Open the map
            </Link>
          </div>
        </div>
      )}
    </nav>
  )
}

export default Nav
