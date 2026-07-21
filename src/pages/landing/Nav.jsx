import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from './shared'

/* ─── Navigation ─── */
function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  const links = ['About', 'Features', 'Explore', 'Video', 'Support', 'FAQ']
  const scrollTo = (id) => {
    document.getElementById(id.toLowerCase())?.scrollIntoView({ behavior: 'smooth' })
    setMobileOpen(false)
  }

  return (
    <nav
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        transition: 'all 0.4s ease',
        background: scrolled ? 'rgba(11,19,38,0.92)' : 'transparent',
        backdropFilter: scrolled ? 'blur(24px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(77,67,84,0.4)' : 'none',
      }}
    >
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px' }}>
        <div className="flex items-center justify-between" style={{ height: 72 }}>
          <Logo size={36} />

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-8">
            {links.map(l => (
              <button key={l} onClick={() => scrollTo(l)} className="nav-link" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                {l}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link to="/map" className="btn-primary hidden md:inline-flex" style={{ padding: '10px 22px', fontSize: 14 }}>
              Open Maps
            </Link>
            <button className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 22 }}>
              {mobileOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden glass" style={{ borderRadius: 16, padding: '16px 0', marginBottom: 8 }}>
            {links.map(l => (
              <button key={l} onClick={() => scrollTo(l)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 24px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontFamily: 'Inter', fontSize: 15 }}>
                {l}
              </button>
            ))}
            <div style={{ padding: '12px 24px' }}>
              <Link to="/map" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                Open Maps
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

export default Nav
