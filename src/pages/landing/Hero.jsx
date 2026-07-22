import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  MapPin, Send, Building2, CreditCard, Printer, BusFront,
  Map, Search, Star, User, Satellite, Play,
} from 'lucide-react'
import { Pin } from './shared'

/* ─── Hero phone mockup ─── */
function PhoneMockup() {
  const routeRef = useRef(null)
  useEffect(() => {
    const el = routeRef.current
    if (!el) return
    const len = el.getTotalLength()
    el.style.strokeDasharray = String(len)
    el.style.strokeDashoffset = String(len)
    el.style.transition = 'stroke-dashoffset 3s ease 0.5s'
    setTimeout(() => { el.style.strokeDashoffset = '0' }, 100)
  }, [])

  const pins = [
    { x: 90, y: 120, color: '#44e2cd', label: 'Library' },
    { x: 170, y: 160, color: '#b76dff', label: 'ATM' },
    { x: 130, y: 220, color: '#ffb95f', label: 'Hostel' },
    { x: 200, y: 280, color: '#44e2cd', label: 'Cafeteria' },
    { x: 80, y: 280, color: '#b76dff', label: 'Clinic' },
  ]

  return (
    <div className="relative" style={{ width: 280, margin: '0 auto' }}>
      {/* Ambient glow behind phone */}
      <div style={{
        position: 'absolute', inset: '-40px', borderRadius: '50%',
        background: 'radial-gradient(ellipse, rgba(183,109,255,0.25) 0%, transparent 70%)',
        filter: 'blur(20px)',
      }} />

      {/* Phone frame */}
      <div className="animate-float" style={{
        position: 'relative',
        width: 260, height: 520, margin: '0 auto',
        background: 'linear-gradient(160deg, #2d2d45 0%, #1a1a2e 100%)',
        borderRadius: 44,
        border: '3px solid rgba(183,109,255,0.3)',
        boxShadow: '0 30px 80px rgba(0,0,0,0.5), 0 0 40px rgba(183,109,255,0.15), inset 0 1px 0 rgba(255,255,255,0.1)',
        overflow: 'hidden',
      }}>
        {/* Notch */}
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 80, height: 26, background: '#1a1a2e', borderRadius: '0 0 16px 16px', zIndex: 10 }} />

        {/* Screen content */}
        <div style={{ position: 'absolute', inset: 3, borderRadius: 42, overflow: 'hidden', background: '#e8f0e8' }}>
          {/* Map background */}
          <svg width="100%" height="100%" viewBox="0 0 254 514" style={{ position: 'absolute', inset: 0 }}>
            <rect width="254" height="514" fill="#e8f0e8" />
            {/* Roads */}
            <line x1="0" y1="180" x2="254" y2="180" stroke="#d0dcd0" strokeWidth="8" />
            <line x1="0" y1="320" x2="254" y2="320" stroke="#d0dcd0" strokeWidth="6" />
            <line x1="80" y1="0" x2="80" y2="514" stroke="#d0dcd0" strokeWidth="6" />
            <line x1="180" y1="0" x2="180" y2="514" stroke="#d0dcd0" strokeWidth="8" />
            <line x1="130" y1="0" x2="130" y2="514" stroke="#d8e4d8" strokeWidth="4" />
            {/* Campus blocks */}
            <rect x="90" y="50" width="70" height="60" fill="#d4e8d4" rx="4" stroke="#c0d0c0" strokeWidth="1" />
            <rect x="90" y="200" width="50" height="50" fill="#d4e8d4" rx="4" stroke="#c0d0c0" strokeWidth="1" />
            <rect x="160" y="200" width="60" height="80" fill="#d4e8d4" rx="4" stroke="#c0d0c0" strokeWidth="1" />
            <rect x="20" y="200" width="50" height="60" fill="#cce0cc" rx="4" stroke="#b8ccb8" strokeWidth="1" />
            <rect x="20" y="340" width="80" height="60" fill="#d4e8d4" rx="4" stroke="#c0d0c0" strokeWidth="1" />
            <rect x="140" y="340" width="90" height="80" fill="#d4e8d4" rx="4" stroke="#c0d0c0" strokeWidth="1" />
            {/* Animated navigation route */}
            <path
              ref={routeRef}
              d="M 90 120 C 110 120 130 140 130 180 S 160 240 200 280"
              stroke="#b76dff"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              strokeDasharray="1000"
              strokeDashoffset="1000"
            />
            {/* Direction arrows along route */}
            <circle cx="130" cy="180" r="4" fill="#b76dff" opacity="0.8" />
            <circle cx="160" cy="230" r="4" fill="#b76dff" opacity="0.6" />
          </svg>

          {/* Search bar */}
          <div style={{
            position: 'absolute', top: 36, left: 10, right: 10,
            background: '#1e1e2e', borderRadius: 12, padding: '8px 14px',
            display: 'flex', alignItems: 'center', gap: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}>
            <MapPin size={12} strokeWidth={2} color="#dae2fd" />
            <span style={{ fontFamily: 'Inter', fontSize: 11, color: '#888', flex: 1 }}>Search FUTA campus...</span>
            <div style={{ background: '#b76dff', borderRadius: 8, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Send size={12} strokeWidth={2} color="#fff" /></div>
          </div>

          {/* Category chips */}
          <div style={{ position: 'absolute', top: 82, left: 8, right: 8, display: 'flex', gap: 5, overflowX: 'hidden' }}>
            {[[Building2, 'Halls'], [CreditCard, 'ATM'], [Printer, 'Print'], [BusFront, 'Bus']].map(([ChipIcon, label]) => (
              <div key={label} style={{ background: 'rgba(30,30,46,0.9)', borderRadius: 8, padding: '4px 8px', fontSize: 9, fontFamily: 'Inter', color: '#dae2fd', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 3 }}>
                <ChipIcon size={9} strokeWidth={2} /> {label}
              </div>
            ))}
          </div>

          {/* Location pins */}
          {pins.map((p, i) => (
            <div key={i} style={{ position: 'absolute', left: p.x - 5, top: p.y - 13 }}>
              <Pin color={p.color} size={10} />
            </div>
          ))}

          {/* Bottom nav */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'rgba(20,20,35,0.95)', padding: '10px 20px',
            display: 'flex', justifyContent: 'space-around',
            backdropFilter: 'blur(8px)',
          }}>
            {[Map, Search, Star, User].map((NavIcon, i) => (
              <NavIcon key={i} size={18} strokeWidth={2} color="#dae2fd" style={{ opacity: i === 0 ? 1 : 0.5 }} />
            ))}
          </div>
        </div>
      </div>

      {/* Floating stat cards */}
      <div className="animate-float-card" style={{
        position: 'absolute', top: 60, right: -50,
        background: 'rgba(34,42,61,0.9)', backdropFilter: 'blur(16px)',
        border: '1px solid rgba(68,226,205,0.3)', borderRadius: 14,
        padding: '10px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        animationDelay: '0.5s',
      }}>
        <div style={{ fontFamily: 'Inter', fontSize: 18, fontWeight: 700, color: '#44e2cd' }}>475+</div>
        <div style={{ fontFamily: 'Poppins', fontSize: 10, color: 'var(--muted)' }}>Locations</div>
      </div>
      <div className="animate-float-card" style={{
        position: 'absolute', top: 180, left: -55,
        background: 'rgba(34,42,61,0.9)', backdropFilter: 'blur(16px)',
        border: '1px solid rgba(183,109,255,0.3)', borderRadius: 14,
        padding: '10px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        animationDelay: '1.5s',
      }}>
        <div style={{ marginBottom: 2 }}><Satellite size={16} strokeWidth={2} color="#ddb7ff" /></div>
        <div style={{ fontFamily: 'Inter', fontSize: 11, fontWeight: 600, color: '#ddb7ff' }}>Live GPS</div>
      </div>
      <div className="animate-float-card" style={{
        position: 'absolute', bottom: 120, right: -60,
        background: 'rgba(34,42,61,0.9)', backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,185,95,0.3)', borderRadius: 14,
        padding: '10px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        animationDelay: '1s',
      }}>
        <div style={{ fontFamily: 'Inter', fontSize: 18, fontWeight: 700, color: '#ffb95f' }}>20+</div>
        <div style={{ fontFamily: 'Poppins', fontSize: 10, color: 'var(--muted)' }}>Categories</div>
      </div>
    </div>
  )
}

/* ─── Hero section ─── */
function Hero() {
  return (
    <section id="about" style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      position: 'relative', overflow: 'hidden',
      paddingTop: 80,
      background: 'linear-gradient(160deg, #0b1326 0%, #1a0d2e 40%, #0b1326 100%)',
    }}>
      {/* Background orbs */}
      <div style={{ position: 'absolute', top: '10%', left: '5%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(73,0,128,0.25) 0%, transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '5%', right: '5%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(68,226,205,0.1) 0%, transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none' }} />

      {/* Particle dots */}
      {Array.from({ length: 20 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${(i * 47 + 10) % 95}%`,
          top: `${(i * 37 + 5) % 90}%`,
          width: i % 3 === 0 ? 3 : 2, height: i % 3 === 0 ? 3 : 2,
          borderRadius: '50%',
          background: i % 2 === 0 ? 'rgba(183,109,255,0.5)' : 'rgba(68,226,205,0.4)',
          animation: `particle ${3 + (i % 4)}s ease-in-out infinite`,
          animationDelay: `${(i * 0.4) % 4}s`,
          pointerEvents: 'none',
        }} />
      ))}

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '80px 24px', width: '100%' }}>
        <div className="flex flex-col lg:flex-row items-center gap-16">
          {/* Left copy */}
          <div style={{ flex: 1, maxWidth: 580 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(183,109,255,0.12)', border: '1px solid rgba(183,109,255,0.3)',
              borderRadius: 100, padding: '6px 16px', marginBottom: 24,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#44e2cd', boxShadow: '0 0 8px #44e2cd', display: 'inline-block', animation: 'blink 2s ease-in-out infinite' }} />
              <span style={{ fontFamily: 'Inter', fontSize: 13, color: 'var(--muted)' }}>Now live at mapsbyfuta.xyz</span>
            </div>

            <h1 style={{
              fontFamily: "'Bricolage Grotesque', sans-serif",
              fontSize: 'clamp(40px, 6vw, 74px)',
              fontWeight: 800,
              lineHeight: 1.05,
              marginBottom: 24,
              letterSpacing: '-1px',
            }}>
              <span style={{ color: 'var(--text)' }}>Never Get Lost</span>
              <br />
              <span className="text-gradient-purple">on Campus Again.</span>
            </h1>

            <p style={{
              fontFamily: 'Poppins', fontSize: 17, lineHeight: 1.75,
              color: 'var(--muted)', marginBottom: 36, maxWidth: 500,
            }}>
              Navigate lecture halls, hostels, ATMs, restaurants, banks, classrooms, printing shops, clinics, bus stops, and hundreds of campus locations with live turn-by-turn navigation built exclusively for FUTA.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link to="/map" className="btn-primary">
                <Map size={18} strokeWidth={2} /> Explore the Map
              </Link>
              <button onClick={() => document.getElementById('video')?.scrollIntoView({ behavior: 'smooth' })} className="btn-secondary">
                <Play size={16} strokeWidth={2} fill="currentColor" /> Watch Demo
              </button>
            </div>

            {/* Mini stats row */}
            <div className="flex flex-wrap gap-8" style={{ marginTop: 48 }}>
              {[['475+', 'Campus Locations'], ['20+', 'Categories'], ['Live', 'GPS Navigation']].map(([val, label]) => (
                <div key={label}>
                  <div style={{ fontFamily: "'Bricolage Grotesque'", fontSize: 24, fontWeight: 800, color: 'var(--purple-light)', marginBottom: 4 }}>{val}</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 12, color: 'var(--muted)' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right phone mockup */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <PhoneMockup />
          </div>
        </div>
      </div>
    </section>
  )
}

export default Hero
