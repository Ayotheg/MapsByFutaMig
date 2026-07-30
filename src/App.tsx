import { useState, useEffect, useRef } from 'react'
import {
  X, Menu, MapPin, GraduationCap, Landmark, Printer, BusFront, Map, Search, Star,
  User, Radio, CheckCircle2, Zap, Satellite, Globe, Compass, Lock, Smartphone,
  Check, ArrowRight, Hospital, UtensilsCrossed, House, Target, Footprints, Car,
  Frown, Clock, Users, BookOpen, Shirt, SquareParking, Backpack, ShoppingBag,
  FlaskConical, Church, Fuel, Brain, Construction, Wifi, Heart, MessageCircle,
  ExternalLink, Camera, Play, Building2, Gift,
} from 'lucide-react'
import FootballIcon from './lib/FootballIcon'
import MosqueIcon from './lib/MosqueIcon'
// Moved to src/assets/ during Task 1 (asset migration) — path is relative
// to src/pages/landing/, where Task 2 plans to place the split-up files.
import mapsFlyerImg from '../../assets/MAPSBYFUTA.jpg'
import logoImg from '../../assets/MapssByFuta.jpg'

/* ─── Scroll reveal hook ─── */
function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

/* ─── Counter hook ─── */
function useCounter(target: number, suffix = '', active = false) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!active) return
    let start = 0
    const duration = 2000
    const step = duration / target
    const timer = setInterval(() => {
      start += Math.ceil(target / 60)
      if (start >= target) { setCount(target); clearInterval(timer) }
      else setCount(start)
    }, step)
    return () => clearInterval(timer)
  }, [active, target])
  return `${count}${suffix}`
}

/* ─── Map pin SVG ─── */
const Pin = ({ color = '#44e2cd', size = 10 }: { color?: string; size?: number }) => (
  <svg width={size} height={size * 1.3} viewBox="0 0 10 13" fill="none">
    <path d="M5 0C2.24 0 0 2.24 0 5c0 3.75 5 8 5 8s5-4.25 5-8c0-2.76-2.24-5-5-5z" fill={color} />
    <circle cx="5" cy="5" r="2" fill="white" fillOpacity={0.9} />
  </svg>
)

/* ─── Logo component ─── */
const Logo = ({ size = 32, inverted = true }: { size?: number; inverted?: boolean }) => (
  <div className="flex items-center gap-2">
    <img
      src={logoImg}
      alt="MapsByFuta logo"
      style={{ height: size, width: 'auto', filter: inverted ? 'invert(1) brightness(1.5)' : 'none' }}
    />
  </div>
)

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
  const scrollTo = (id: string) => {
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
            <a href="https://mapsbyfuta.xyz" target="_blank" rel="noreferrer" className="btn-primary hidden md:inline-flex" style={{ padding: '10px 22px', fontSize: 14 }}>
              Open Maps
            </a>
            <button className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 22 }}>
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
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
              <a href="https://mapsbyfuta.xyz" target="_blank" rel="noreferrer" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                Open Maps
              </a>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

/* ─── Hero phone mockup ─── */
function PhoneMockup() {
  const routeRef = useRef<SVGPathElement>(null)
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
            <MapPin size={12} />
            <span style={{ fontFamily: 'Inter', fontSize: 11, color: '#888', flex: 1 }}>Search FUTA campus...</span>
            <div style={{ background: '#b76dff', borderRadius: 8, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowRight size={12} color="#fff" />
            </div>
          </div>

          {/* Category chips */}
          <div style={{ position: 'absolute', top: 82, left: 8, right: 8, display: 'flex', gap: 5, overflowX: 'hidden' }}>
            {[
              { Icon: GraduationCap, label: 'Halls' },
              { Icon: Landmark, label: 'ATM' },
              { Icon: Printer, label: 'Print' },
              { Icon: BusFront, label: 'Bus' },
            ].map(({ Icon, label }) => (
              <div key={label} style={{ background: 'rgba(30,30,46,0.9)', borderRadius: 8, padding: '4px 8px', fontSize: 9, fontFamily: 'Inter', color: '#dae2fd', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Icon size={10} /> {label}
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
            {[Map, Search, Star, User].map((Icon, i) => (
              <Icon key={i} size={18} style={{ opacity: i === 0 ? 1 : 0.5 }} />
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
        <div style={{ fontFamily: 'Inter', fontSize: 18, fontWeight: 700, color: '#44e2cd' }}>100+</div>
        <div style={{ fontFamily: 'Poppins', fontSize: 10, color: 'var(--muted)' }}>Locations</div>
      </div>
      <div className="animate-float-card" style={{
        position: 'absolute', top: 180, left: -55,
        background: 'rgba(34,42,61,0.9)', backdropFilter: 'blur(16px)',
        border: '1px solid rgba(183,109,255,0.3)', borderRadius: 14,
        padding: '10px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        animationDelay: '1.5s',
      }}>
        <div style={{ marginBottom: 2, color: '#ddb7ff' }}>
          <Satellite size={14} />
        </div>
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
              <a href="https://mapsbyfuta.xyz" target="_blank" rel="noreferrer" className="btn-primary">
                <Map size={16} /> Explore the Map
              </a>
              <button onClick={() => document.getElementById('video')?.scrollIntoView({ behavior: 'smooth' })} className="btn-secondary">
                <Play size={16} fill="currentColor" /> Watch Demo
              </button>
            </div>

            {/* Mini stats row */}
            <div className="flex flex-wrap gap-6 mt-10">
              {[['100+', 'Campus Locations'], ['20+', 'Categories'], ['Live', 'GPS Navigation']].map(([val, label]) => (
                <div key={label}>
                  <div style={{ fontFamily: "'Bricolage Grotesque'", fontSize: 24, fontWeight: 800, color: 'var(--purple-light)' }}>{val}</div>
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

/* ─── Trust bar ─── */
function TrustBar() {
  const badges = [
    { Icon: Landmark, label: 'Built for FUTA' }, { Icon: Radio, label: 'Live Navigation' },
    { Icon: Smartphone, label: 'Mobile First' }, { Icon: Search, label: 'Smart Search' },
    { Icon: Satellite, label: 'GPS Enabled' }, { Icon: Globe, label: 'Responsive' },
    { Icon: CheckCircle2, label: 'Campus Verified' }, { Icon: Zap, label: 'Fast & Free' },
    { Icon: Map, label: 'Interactive Map' }, { Icon: Star, label: 'Community Reviews' },
    { Icon: Compass, label: 'Turn-by-Turn' }, { Icon: Lock, label: 'Trusted Platform' },
  ]
  const doubled = [...badges, ...badges]

  return (
    <div style={{
      background: 'rgba(19,27,46,0.8)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
      padding: '18px 0', overflow: 'hidden',
    }}>
      <div className="animate-ticker" style={{ display: 'flex', gap: 48, width: 'max-content' }}>
        {doubled.map(({ Icon, label }, i) => (
          <div key={i} className="flex items-center gap-2" style={{ whiteSpace: 'nowrap' }}>
            <Icon size={14} style={{ color: 'var(--muted)' }} />
            <span style={{ fontFamily: 'Inter', fontSize: 14, fontWeight: 500, color: 'var(--muted)' }}>{label}</span>
            <span style={{ color: 'rgba(183,109,255,0.4)', fontSize: 10 }}>◆</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Discover section ─── */
function DiscoverSection() {
  const { ref, visible } = useReveal()
  return (
    <section id="features" style={{ padding: '120px 24px', background: 'var(--bg-darkest)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', right: 0, top: '20%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(73,0,128,0.2) 0%, transparent 70%)', filter: 'blur(50px)', pointerEvents: 'none' }} />

      <div ref={ref} style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Label */}
        <div className={`reveal ${visible ? 'visible' : ''}`} style={{ textAlign: 'center', marginBottom: 16 }}>
          <span style={{ fontFamily: 'Montserrat', fontSize: 12, fontWeight: 700, letterSpacing: 4, color: 'var(--teal)', textTransform: 'uppercase' }}>Discover</span>
        </div>
        <h2 className={`reveal ${visible ? 'visible' : ''}`} style={{ textAlign: 'center', fontFamily: "'Bricolage Grotesque'", fontSize: 'clamp(32px,4vw,54px)', fontWeight: 800, marginBottom: 64, transitionDelay: '0.1s' }}>
          Meet <span className="text-gradient-purple">Maps By FUTA</span>
        </h2>

        <div className="flex flex-col lg:flex-row items-center gap-16">
          {/* Flyer */}
          <div className={`reveal ${visible ? 'visible' : ''} flex-1 flex justify-center`} style={{ transitionDelay: '0.15s' }}>
            <div className="animate-pulse-glow" style={{
              position: 'relative', borderRadius: 24,
              boxShadow: '0 30px 80px rgba(0,0,0,0.5), 0 0 60px rgba(183,109,255,0.2)',
              transition: 'transform 0.3s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.02) rotate(-0.5deg)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1) rotate(0deg)')}>
              <img
                src={mapsFlyerImg}
                alt="Maps By FUTA promotional flyer"
                style={{ width: '100%', maxWidth: 380, borderRadius: 24, display: 'block', objectFit: 'cover' }}
              />
              <div style={{
                position: 'absolute', bottom: -16, left: '50%', transform: 'translateX(-50%)',
                background: 'rgba(19,27,46,0.95)', backdropFilter: 'blur(16px)',
                border: '1px solid rgba(183,109,255,0.3)', borderRadius: 12,
                padding: '8px 20px', whiteSpace: 'nowrap',
              }}>
                <span style={{ fontFamily: 'Inter', fontSize: 13, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Smartphone size={14} /> Prefer your phone? Scan to explore instantly.
                </span>
              </div>
            </div>
          </div>

          {/* Right copy */}
          <div className={`reveal ${visible ? 'visible' : ''} flex-1`} style={{ transitionDelay: '0.25s' }}>
            <h3 style={{ fontFamily: "'Bricolage Grotesque'", fontSize: 'clamp(28px,3.5vw,46px)', fontWeight: 800, lineHeight: 1.15, marginBottom: 20 }}>
              Built for Every<br /><span className="text-gradient-teal">FUTA Student.</span>
            </h3>
            <p style={{ fontFamily: 'Poppins', fontSize: 16, lineHeight: 1.75, color: 'var(--muted)', marginBottom: 32 }}>
              Maps By FUTA makes navigating campus simple—whether you're a fresher trying to find your lecture hall, a parent visiting for the first time, or a student heading to the bank between classes.
            </p>

            {[
              ['Never get lost on campus', 'Accurate, up-to-date campus map always in your pocket'],
              ['Discover every important location', 'From classrooms to clinics, hostels to fuel stations—100+ places mapped'],
              ['Navigate confidently with live directions', 'Turn-by-turn GPS routes so you always know where to go'],
            ].map(([title, desc]) => (
              <div key={title} className="flex items-start gap-4" style={{ marginBottom: 20 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg,#44e2cd,#03c6b2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                  <Check size={13} color="#0b1326" strokeWidth={3} />
                </div>
                <div>
                  <div style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 15, color: 'var(--text)', marginBottom: 4 }}>{title}</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 14, color: 'var(--muted)' }}>{desc}</div>
                </div>
              </div>
            ))}

            <div style={{ marginTop: 36 }}>
              <a href="https://mapsbyfuta.xyz" target="_blank" rel="noreferrer" className="btn-primary">
                <Map size={16} /> Open the Map
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── Feature showcase ─── */
function FeatureShowcase({ index, title, Icon, tagline, bullets, visual }: {
  index: number
  title: string
  Icon: React.ComponentType<{ size?: number }>
  tagline: string
  bullets: string[]
  visual: React.ReactNode
}) {
  const { ref, visible } = useReveal()
  const isEven = index % 2 === 0

  return (
    <div ref={ref} className={`reveal ${visible ? 'visible' : ''} flex flex-col ${isEven ? 'lg:flex-row' : 'lg:flex-row-reverse'} items-center gap-16`} style={{ marginBottom: 100, transitionDelay: `${0.05 * index}s` }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'Montserrat', fontSize: 12, fontWeight: 700, letterSpacing: 4, color: 'var(--teal)', textTransform: 'uppercase', marginBottom: 12 }}>
          Feature {String(index + 1).padStart(2, '0')}
        </div>
        <h3 style={{ fontFamily: "'Bricolage Grotesque'", fontSize: 'clamp(26px,3vw,42px)', fontWeight: 800, lineHeight: 1.15, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Icon size={30} /> {title}
        </h3>
        <p style={{ fontFamily: 'Poppins', fontSize: 16, lineHeight: 1.75, color: 'var(--muted)', marginBottom: 28 }}>{tagline}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {bullets.map(b => (
            <div key={b} className="flex items-center gap-3">
              <ArrowRight size={14} color="#44e2cd" />
              <span style={{ fontFamily: 'Poppins', fontSize: 15, color: 'var(--text)' }}>{b}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        {visual}
      </div>
    </div>
  )
}

/* ─── Feature visuals ─── */
const MapFeatureVisual = () => (
  <div className="glass-card feature-card-hover" style={{ width: '100%', maxWidth: 400, padding: 24, borderRadius: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
    <div style={{ background: '#e8f0e8', borderRadius: 16, overflow: 'hidden', height: 240, position: 'relative' }}>
      <svg width="100%" height="100%" viewBox="0 0 360 240">
        <rect width="360" height="240" fill="#e8f0e8" />
        <line x1="0" y1="80" x2="360" y2="80" stroke="#d0dcd0" strokeWidth="10" />
        <line x1="0" y1="160" x2="360" y2="160" stroke="#d0dcd0" strokeWidth="6" />
        <line x1="100" y1="0" x2="100" y2="240" stroke="#d0dcd0" strokeWidth="8" />
        <line x1="240" y1="0" x2="240" y2="240" stroke="#d0dcd0" strokeWidth="6" />
        <rect x="110" y="20" width="80" height="50" fill="#c8e0c8" rx="6" />
        <rect x="110" y="90" width="80" height="60" fill="#c8e0c8" rx="6" />
        <rect x="250" y="20" width="80" height="50" fill="#c8e0c8" rx="6" />
        <rect x="250" y="90" width="80" height="70" fill="#c8e0c8" rx="6" />
        <rect x="20" y="90" width="60" height="60" fill="#c0d8c0" rx="6" />
        <rect x="110" y="170" width="80" height="55" fill="#c8e0c8" rx="6" />
        <rect x="250" y="170" width="80" height="55" fill="#c8e0c8" rx="6" />
        {[
          [150, 45, '#b76dff'], [290, 45, '#44e2cd'], [150, 120, '#ffb95f'],
          [290, 125, '#b76dff'], [50, 120, '#44e2cd'], [150, 197, '#ffb95f'],
        ].map(([x, y, c], i) => (
          <circle key={i} cx={x} cy={y} r={7} fill={c as string} opacity={0.9} />
        ))}
      </svg>
    </div>
    <div className="flex flex-wrap gap-2" style={{ marginTop: 16 }}>
      {[
        { Icon: GraduationCap, label: 'Academic' }, { Icon: Landmark, label: 'ATM' },
        { Icon: Hospital, label: 'Clinic' }, { Icon: UtensilsCrossed, label: 'Food' },
        { Icon: House, label: 'Hostels' },
      ].map(({ Icon, label }) => (
        <span key={label} style={{ fontFamily: 'Inter', fontSize: 12, background: 'rgba(183,109,255,0.12)', border: '1px solid rgba(183,109,255,0.2)', borderRadius: 8, padding: '4px 10px', color: 'var(--purple-light)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <Icon size={12} /> {label}
        </span>
      ))}
    </div>
  </div>
)

const SearchFeatureVisual = () => (
  <div className="glass-card feature-card-hover" style={{ width: '100%', maxWidth: 400, padding: 28, borderRadius: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
    <div style={{ background: 'rgba(183,109,255,0.08)', border: '1px solid rgba(183,109,255,0.2)', borderRadius: 14, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <Search size={16} />
      <span style={{ fontFamily: 'Inter', fontSize: 14, color: 'var(--muted)' }}>CBT Centre...</span>
      <div style={{ marginLeft: 'auto', background: '#b76dff', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontFamily: 'Inter', color: 'white' }}>Search</div>
    </div>
    {[
      { name: 'CBT Centre', cat: 'Academic', dist: '200m', color: '#b76dff' },
      { name: 'Senate Building', cat: 'Admin', dist: '450m', color: '#44e2cd' },
      { name: 'Main Library', cat: 'Academic', dist: '600m', color: '#ffb95f' },
      { name: 'FUTA South Gate', cat: 'Entrance', dist: '1.2km', color: '#b76dff' },
    ].map((r, i) => (
      <div key={r.name} className="flex items-center gap-3" style={{
        padding: '10px 12px', borderRadius: 12, marginBottom: 6,
        background: i === 0 ? 'rgba(183,109,255,0.12)' : 'rgba(34,42,61,0.4)',
        border: `1px solid ${i === 0 ? 'rgba(183,109,255,0.3)' : 'rgba(77,67,84,0.3)'}`,
        transition: 'all 0.2s',
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Inter', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{r.name}</div>
          <div style={{ fontFamily: 'Poppins', fontSize: 11, color: 'var(--muted)' }}>{r.cat}</div>
        </div>
        <div style={{ fontFamily: 'Inter', fontSize: 12, color: '#44e2cd' }}>{r.dist}</div>
      </div>
    ))}
  </div>
)

const NavFeatureVisual = () => (
  <div className="glass-card feature-card-hover" style={{ width: '100%', maxWidth: 400, padding: 28, borderRadius: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
    <div style={{ background: '#e8f0e8', borderRadius: 16, height: 180, position: 'relative', overflow: 'hidden', marginBottom: 20 }}>
      <svg width="100%" height="100%" viewBox="0 0 360 180">
        <rect width="360" height="180" fill="#e8f0e8" />
        <line x1="0" y1="90" x2="360" y2="90" stroke="#d0dcd0" strokeWidth="8" />
        <line x1="180" y1="0" x2="180" y2="180" stroke="#d0dcd0" strokeWidth="6" />
        <path d="M 60 150 C 100 150 140 90 180 90 S 260 50 300 30" stroke="#b76dff" strokeWidth="4" fill="none" strokeDasharray="8 4" strokeLinecap="round" />
        <circle cx="60" cy="150" r="8" fill="#44e2cd" />
        <circle cx="300" cy="30" r="8" fill="#b76dff" />
        {[100, 140, 200, 250].map((x, i) => (
          <circle key={i} cx={x} cy={90 - (i % 2) * 40 + (i % 3) * 20} r={4} fill="rgba(183,109,255,0.6)" />
        ))}
      </svg>
      <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(11,19,38,0.9)', borderRadius: 8, padding: '4px 10px' }}>
        <span style={{ fontFamily: 'Inter', fontSize: 11, color: '#44e2cd', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <MapPin size={11} /> Current Location
        </span>
      </div>
      <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(11,19,38,0.9)', borderRadius: 8, padding: '4px 10px' }}>
        <span style={{ fontFamily: 'Inter', fontSize: 11, color: '#b76dff', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Target size={11} /> Destination
        </span>
      </div>
    </div>
    <div className="flex gap-3">
      {[
        { Icon: Footprints, val: '8 min', label: 'Walk' },
        { Icon: Car, val: '3 min', label: 'Drive' },
        { Icon: Satellite, val: 'Live', label: 'GPS' },
      ].map(({ Icon, val, label }) => (
        <div key={label} style={{ flex: 1, background: 'rgba(34,42,61,0.5)', borderRadius: 12, padding: '10px', textAlign: 'center', border: '1px solid rgba(77,67,84,0.4)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 2 }}><Icon size={16} /></div>
          <div style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 15, color: 'var(--purple-light)' }}>{val}</div>
          <div style={{ fontFamily: 'Poppins', fontSize: 10, color: 'var(--muted)' }}>{label}</div>
        </div>
      ))}
    </div>
  </div>
)

const ReviewsFeatureVisual = () => (
  <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 14 }}>
    {[
      { name: 'FoodCourt A', rating: 4.8, reviews: 124, tag: 'Restaurant', comment: "Best jollof on campus, always fresh!" },
      { name: 'FUTA Health Centre', rating: 4.5, reviews: 89, tag: 'Clinic', comment: "Fast service, always available." },
      { name: 'Zenith Bank ATM', rating: 4.2, reviews: 210, tag: 'ATM', comment: "Rarely out of cash, good location." },
    ].map(r => (
      <div key={r.name} className="glass-card feature-card-hover" style={{ padding: '16px 20px' }}>
        <div className="flex items-start justify-between" style={{ marginBottom: 8 }}>
          <div>
            <div style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>{r.name}</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: 'var(--muted)' }}>{r.tag} · {r.reviews} reviews</div>
          </div>
          <div className="flex items-center gap-1">
            <Star size={14} color="#ffb95f" fill="#ffb95f" />
            <span style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 14, color: '#ffb95f' }}>{r.rating}</span>
          </div>
        </div>
        <p style={{ fontFamily: 'Poppins', fontSize: 13, color: 'var(--muted)', fontStyle: 'italic' }}>"{r.comment}"</p>
      </div>
    ))}
  </div>
)

const MobileFeatureVisual = () => (
  <div style={{ position: 'relative', width: 200, margin: '0 auto' }}>
    <div style={{ position: 'absolute', inset: '-30px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(183,109,255,0.2) 0%, transparent 70%)', filter: 'blur(20px)' }} />
    <div className="animate-float" style={{
      width: 200, height: 400, background: 'linear-gradient(160deg,#2d2d45,#1a1a2e)',
      borderRadius: 36, border: '2px solid rgba(183,109,255,0.3)',
      boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 30px rgba(183,109,255,0.1)',
      overflow: 'hidden', position: 'relative',
    }}>
      <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 60, height: 18, background: '#1a1a2e', borderRadius: '0 0 10px 10px' }} />
      <div style={{ padding: '30px 14px 14px' }}>
        <div style={{ background: 'rgba(183,109,255,0.12)', borderRadius: 12, padding: '8px 12px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Search size={10} />
          <span style={{ fontFamily: 'Inter', fontSize: 10, color: 'var(--muted)' }}>Search FUTA campus...</span>
        </div>
        <div style={{ background: '#e8f0e8', borderRadius: 12, height: 160, overflow: 'hidden', marginBottom: 12, position: 'relative' }}>
          <svg width="100%" height="100%" viewBox="0 0 172 160">
            <rect width="172" height="160" fill="#e8f0e8" />
            <line x1="0" y1="60" x2="172" y2="60" stroke="#d0dcd0" strokeWidth="6" />
            <line x1="86" y1="0" x2="86" y2="160" stroke="#d0dcd0" strokeWidth="5" />
            <circle cx="86" cy="80" r="8" fill="#b76dff" />
            <circle cx="40" cy="40" r="6" fill="#44e2cd" />
            <circle cx="140" cy="100" r="6" fill="#ffb95f" />
          </svg>
        </div>
        <div className="flex gap-2">
          {[
            { Icon: MapPin, label: 'Near You' }, { Icon: Landmark, label: 'ATM' }, { Icon: UtensilsCrossed, label: 'Food' },
          ].map(({ Icon, label }) => (
            <div key={label} style={{ flex: 1, background: 'rgba(34,42,61,0.6)', borderRadius: 8, padding: '6px 4px', textAlign: 'center', fontSize: 9, fontFamily: 'Inter', color: 'var(--muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <Icon size={11} /> {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
)

function ProductFeatures() {
  const { ref, visible } = useReveal()
  const features = [
    {
      title: 'Interactive Campus Map',
      Icon: Map,
      tagline: 'Explore every corner of FUTA — lecture halls, hostels, restaurants, ATMs, banks, clinics, bus stops, places of worship, sports centres, shopping areas, and many more campus locations.',
      bullets: ['100+ mapped locations', 'Categorized by type', 'Regular map updates', 'Detailed location info'],
      visual: <MapFeatureVisual />,
    },
    {
      title: 'Smart Search',
      Icon: Search,
      tagline: 'Find any campus location instantly with our intelligent search engine. Type a few characters and get instant results with distance, category, and directions.',
      bullets: ['Instant autocomplete', 'Nearby suggestions', 'Distance-aware results', 'Category shortcuts'],
      visual: <SearchFeatureVisual />,
    },
    {
      title: 'Turn-by-Turn Navigation',
      Icon: Compass,
      tagline: 'From your current location to anywhere on campus — get precise walking or driving routes with live GPS, real-time tracking, ETA, and voice guidance.',
      bullets: ['Walking & driving routes', 'Estimated arrival time', 'Live GPS tracking', 'Voice navigation'],
      visual: <NavFeatureVisual />,
    },
    {
      title: 'Community Reviews',
      Icon: Star,
      tagline: 'Students rate restaurants, banks, printing shops, pharmacies, and other campus services — helping fellow students make informed decisions every day.',
      bullets: ['Star ratings & reviews', 'Verified student feedback', 'Most popular places', 'Real-time updates'],
      visual: <ReviewsFeatureVisual />,
    },
    {
      title: 'Mobile First Experience',
      Icon: Smartphone,
      tagline: 'Designed to be beautiful and fast on every screen. Open it in any browser — no app download required. FUTA navigation, always in your pocket.',
      bullets: ['Progressive Web App', 'No download needed', 'Works offline (soon)', 'Fast & lightweight'],
      visual: <MobileFeatureVisual />,
    },
  ]

  return (
    <section style={{ padding: '120px 24px', background: 'var(--bg-dark)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: '10%', top: '10%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(73,0,128,0.12) 0%, transparent 70%)', filter: 'blur(60px)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div ref={ref} style={{ textAlign: 'center', marginBottom: 80 }}>
          <div className={`reveal ${visible ? 'visible' : ''}`} style={{ fontFamily: 'Montserrat', fontSize: 12, fontWeight: 700, letterSpacing: 4, color: 'var(--teal)', textTransform: 'uppercase', marginBottom: 12 }}>Product</div>
          <h2 className={`reveal ${visible ? 'visible' : ''}`} style={{ fontFamily: "'Bricolage Grotesque'", fontSize: 'clamp(32px,4vw,52px)', fontWeight: 800, transitionDelay: '0.1s' }}>
            Everything You Need to<br /><span className="text-gradient-mix">Navigate FUTA.</span>
          </h2>
        </div>

        {features.map((f, i) => (
          <FeatureShowcase key={f.title} index={i} {...f} />
        ))}
      </div>
    </section>
  )
}

/* ─── Video section ─── */
function VideoSection() {
  const { ref, visible } = useReveal()
  return (
    <section id="video" style={{ padding: '120px 24px', background: 'var(--bg-darkest)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, rgba(73,0,128,0.2) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div ref={ref} style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
        <div className={`reveal ${visible ? 'visible' : ''}`} style={{ fontFamily: 'Montserrat', fontSize: 12, fontWeight: 700, letterSpacing: 4, color: 'var(--teal)', textTransform: 'uppercase', marginBottom: 12 }}>Demo</div>
        <h2 className={`reveal ${visible ? 'visible' : ''}`} style={{ fontFamily: "'Bricolage Grotesque'", fontSize: 'clamp(30px,4vw,52px)', fontWeight: 800, marginBottom: 16, transitionDelay: '0.1s' }}>
          Watch Maps By FUTA<br /><span className="text-gradient-purple">in Action.</span>
        </h2>
        <p className={`reveal ${visible ? 'visible' : ''}`} style={{ fontFamily: 'Poppins', fontSize: 17, color: 'var(--muted)', marginBottom: 48, transitionDelay: '0.2s' }}>
          See how Maps By FUTA transforms the way students navigate campus.
        </p>

        <div className={`reveal-scale ${visible ? 'visible' : ''}`} style={{ transitionDelay: '0.25s' }}>
          <div className="animate-pulse-glow" style={{
            background: 'rgba(19,27,46,0.85)', backdropFilter: 'blur(20px)',
            border: '1px solid rgba(183,109,255,0.3)', borderRadius: 28,
            padding: 8, overflow: 'hidden',
            boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #131b2e 0%, #1a0d2e 50%, #131b2e 100%)',
              borderRadius: 22, height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: 20, position: 'relative', overflow: 'hidden',
            }}>
              {/* Decorative route lines */}
              <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.15 }} viewBox="0 0 800 420" preserveAspectRatio="xMidYMid slice">
                <path d="M 0 200 C 150 200 200 100 400 150 S 600 280 800 200" stroke="#b76dff" strokeWidth="2" fill="none" />
                <path d="M 0 300 C 200 280 300 200 500 250 S 700 180 800 300" stroke="#44e2cd" strokeWidth="1.5" fill="none" />
                <circle cx="200" cy="150" r="4" fill="#b76dff" />
                <circle cx="400" cy="150" r="4" fill="#44e2cd" />
                <circle cx="600" cy="240" r="4" fill="#b76dff" />
              </svg>

              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(183,109,255,0.2), rgba(68,226,205,0.1))',
                border: '2px solid rgba(183,109,255,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'transform 0.2s',
                boxShadow: '0 0 30px rgba(183,109,255,0.3)',
              }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
                <div style={{ width: 0, height: 0, borderTop: '18px solid transparent', borderBottom: '18px solid transparent', borderLeft: '30px solid #ddb7ff', marginLeft: 6 }} />
              </div>

              <div>
                <div style={{ fontFamily: 'Montserrat', fontSize: 13, fontWeight: 600, color: 'var(--muted)', letterSpacing: 2, textTransform: 'uppercase' }}>Commercial Coming Soon</div>
                <div style={{ fontFamily: 'Poppins', fontSize: 13, color: 'rgba(183,109,255,0.5)', marginTop: 4 }}>Video placeholder — replace with the commercial</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── Why section ─── */
function WhySection() {
  const { ref, visible } = useReveal()
  const cards = [
    { Icon: Frown, title: 'Freshers Get Lost', body: 'Every new student wastes hours asking for directions to lecture halls, hostels, and cafeterias. The first week on campus shouldn\'t be a navigation test.' },
    { Icon: Clock, title: 'Time Lost to Confusion', body: 'Students miss classes, appointments, and events simply because campus is vast and confusing. Time is too valuable to waste getting lost.' },
    { Icon: Users, title: 'Visitors Struggle', body: 'Parents, guests, and new staff are left to wander a large campus with no reliable guidance, creating frustration and a poor first impression.' },
  ]

  return (
    <section style={{ padding: '120px 24px', background: 'var(--bg-mid)', position: 'relative' }}>
      <div ref={ref} style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div className="flex flex-col lg:flex-row gap-16 items-start">
          <div style={{ flex: 1 }}>
            <div className={`reveal ${visible ? 'visible' : ''}`} style={{ fontFamily: 'Montserrat', fontSize: 12, fontWeight: 700, letterSpacing: 4, color: 'var(--orange)', textTransform: 'uppercase', marginBottom: 12 }}>Our Why</div>
            <h2 className={`reveal ${visible ? 'visible' : ''}`} style={{ fontFamily: "'Bricolage Grotesque'", fontSize: 'clamp(30px,4vw,50px)', fontWeight: 800, lineHeight: 1.15, marginBottom: 24, transitionDelay: '0.1s' }}>
              Campus Shouldn't<br /><span className="text-gradient-purple">Be a Maze.</span>
            </h2>
            <p className={`reveal ${visible ? 'visible' : ''}`} style={{ fontFamily: 'Poppins', fontSize: 16, lineHeight: 1.8, color: 'var(--muted)', marginBottom: 28, transitionDelay: '0.2s' }}>
              FUTA is a large, vibrant campus with hundreds of buildings, services, and facilities. But for too long, navigating it has relied on asking strangers, following handmade signs, or simply wandering.
            </p>
            <p className={`reveal ${visible ? 'visible' : ''}`} style={{ fontFamily: 'Poppins', fontSize: 16, lineHeight: 1.8, color: 'var(--muted)', transitionDelay: '0.3s' }}>
              Maps By FUTA was built to solve this—once and for all. A precise, beautiful, purpose-built navigation platform that puts the entire FUTA campus in your hands. No more asking, no more wandering. Just navigate.
            </p>
            <div className={`reveal ${visible ? 'visible' : ''}`} style={{ marginTop: 36, transitionDelay: '0.4s' }}>
              <a href="https://mapsbyfuta.xyz" target="_blank" rel="noreferrer" className="btn-primary">
                Start Navigating <ArrowRight size={16} />
              </a>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {cards.map((c, i) => (
              <div key={c.title} className={`reveal ${visible ? 'visible' : ''} glass-card`} style={{ padding: '24px 28px', transitionDelay: `${0.2 + i * 0.1}s` }}>
                <div style={{ marginBottom: 12, color: 'var(--purple-light)' }}><c.Icon size={28} /></div>
                <div style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 16, marginBottom: 8, color: 'var(--text)' }}>{c.title}</div>
                <p style={{ fontFamily: 'Poppins', fontSize: 14, lineHeight: 1.7, color: 'var(--muted)', margin: 0 }}>{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── Explore categories ─── */
function ExploreSection() {
  const { ref, visible } = useReveal()
  const categories = [
    { Icon: Building2, label: 'Academic Buildings' }, { Icon: GraduationCap, label: 'Lecture Halls' },
    { Icon: House, label: 'Hostels' }, { Icon: UtensilsCrossed, label: 'Restaurants' },
    { Icon: Landmark, label: 'ATMs' }, { Icon: Landmark, label: 'Banks' },
    { Icon: Hospital, label: 'Clinics' }, { Icon: BookOpen, label: 'Library' },
    { Icon: Printer, label: 'Printing Shops' }, { Icon: Shirt, label: 'Laundry' },
    { Icon: BusFront, label: 'Bus Stops' }, { Icon: SquareParking, label: 'Parking' },
    { Icon: Backpack, label: 'Student Affairs' }, { Icon: ShoppingBag, label: 'Shopping Areas' },
    { Icon: FlaskConical, label: 'Laboratories' }, { Icon: FootballIcon, label: 'Sports Centres' },
    { Icon: MosqueIcon, label: 'Mosque' }, { Icon: Church, label: 'Church' },
    { Icon: Fuel, label: 'Fuel Stations' }, { Icon: Lock, label: 'Security Posts' },
  ]

  return (
    <section id="explore" style={{ padding: '120px 24px', background: 'var(--bg-dark)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', right: '5%', bottom: '10%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(68,226,205,0.08) 0%, transparent 70%)', filter: 'blur(60px)', pointerEvents: 'none' }} />

      <div ref={ref} style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div className={`reveal ${visible ? 'visible' : ''}`} style={{ fontFamily: 'Montserrat', fontSize: 12, fontWeight: 700, letterSpacing: 4, color: 'var(--teal)', textTransform: 'uppercase', marginBottom: 12 }}>Explore</div>
          <h2 className={`reveal ${visible ? 'visible' : ''}`} style={{ fontFamily: "'Bricolage Grotesque'", fontSize: 'clamp(30px,4vw,52px)', fontWeight: 800, transitionDelay: '0.1s' }}>
            Every Corner of<br /><span className="text-gradient-teal">FUTA Campus.</span>
          </h2>
          <p className={`reveal ${visible ? 'visible' : ''}`} style={{ fontFamily: 'Poppins', fontSize: 16, color: 'var(--muted)', marginTop: 16, transitionDelay: '0.2s' }}>
            From academic buildings to worship centres — everything mapped, everything searchable.
          </p>
        </div>

        <div className={`reveal ${visible ? 'visible' : ''}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, transitionDelay: '0.2s' }}>
          {categories.map((cat, i) => (
            <a key={cat.label} href="https://mapsbyfuta.xyz" target="_blank" rel="noreferrer" className="category-card" style={{
              background: 'rgba(34,42,61,0.5)', backdropFilter: 'blur(12px)',
              border: '1px solid rgba(77,67,84,0.5)', borderRadius: 16,
              padding: '20px 16px', textAlign: 'center', textDecoration: 'none',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              animationDelay: `${i * 0.03}s`,
            }}>
              <cat.Icon size={28} />
              <span style={{ fontFamily: 'Inter', fontSize: 12, fontWeight: 500, color: 'var(--muted)', lineHeight: 1.3 }}>{cat.label}</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Statistics ─── */
function StatCard({ value, label, suffix = '', active }: { value: number; label: string; suffix?: string; active: boolean }) {
  const display = useCounter(value, suffix, active)
  return (
    <div className="text-center" style={{ padding: '20px 10px' }}>
      <div style={{ fontFamily: "'Bricolage Grotesque'", fontSize: 'clamp(40px,5vw,68px)', fontWeight: 800, lineHeight: 1 }} className="text-gradient-purple">
        {active ? display : `0${suffix}`}
      </div>
      <div style={{ fontFamily: 'Poppins', fontSize: 15, color: 'var(--muted)', marginTop: 8 }}>{label}</div>
    </div>
  )
}

function StatsSection() {
  const { ref, visible } = useReveal(0.3)
  const stats = [
    { value: 100, suffix: '+', label: 'Campus Locations' },
    { value: 20, suffix: '+', label: 'Categories' },
    { value: 1, suffix: '', label: 'Campus. Fully Mapped.' },
    { value: 5000, suffix: '+', label: 'Searches Made' },
  ]

  return (
    <section style={{ padding: '100px 24px', background: 'var(--bg-darkest)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, rgba(73,0,128,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div ref={ref} style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div className={`reveal ${visible ? 'visible' : ''}`} style={{ textAlign: 'center', marginBottom: 60 }}>
          <h2 style={{ fontFamily: "'Bricolage Grotesque'", fontSize: 'clamp(28px,3.5vw,46px)', fontWeight: 800 }}>
            Numbers That <span className="text-gradient-purple">Speak for Themselves.</span>
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }}>
          {stats.map(s => (
            <div key={s.label} className="glass-card" style={{ padding: '32px 24px' }}>
              <StatCard {...s} active={visible} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Roadmap ─── */
function RoadmapSection() {
  const { ref, visible } = useReveal()
  const items = [
    { Icon: Brain, title: 'Smarter Navigation', body: 'AI-powered route optimization that learns campus traffic patterns and suggests the fastest paths.' },
    { Icon: Star, title: 'Community Reviews v2', body: 'Expanded review system with photos, detailed ratings, and verified student-only feedback.' },
    { Icon: Construction, title: 'More Campus Services', body: 'Mapping every hostel room block, new buildings, shuttle routes, and real-time facility availability.' },
    { Icon: Users, title: 'Student Contributions', body: 'Let students submit new locations, flag outdated data, and help keep Maps By FUTA accurate.' },
    { Icon: Wifi, title: 'Offline Mode', body: 'Download campus maps for offline use — navigate even without mobile data.' },
  ]

  return (
    <section style={{ padding: '120px 24px', background: 'var(--bg-mid)', position: 'relative', overflow: 'hidden' }}>
      <div ref={ref} style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div className={`reveal ${visible ? 'visible' : ''}`} style={{ fontFamily: 'Montserrat', fontSize: 12, fontWeight: 700, letterSpacing: 4, color: 'var(--orange)', textTransform: 'uppercase', marginBottom: 12 }}>Roadmap</div>
          <h2 className={`reveal ${visible ? 'visible' : ''}`} style={{ fontFamily: "'Bricolage Grotesque'", fontSize: 'clamp(30px,4vw,52px)', fontWeight: 800, transitionDelay: '0.1s' }}>
            What's Coming<br /><span className="text-gradient-purple">Next.</span>
          </h2>
          <p className={`reveal ${visible ? 'visible' : ''}`} style={{ fontFamily: 'Poppins', fontSize: 16, color: 'var(--muted)', marginTop: 16, transitionDelay: '0.2s' }}>
            Maps By FUTA is just getting started. Here's where we're headed.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {items.map((item, i) => (
            <div key={item.title} className={`reveal ${visible ? 'visible' : ''} roadmap-card glass-card`} style={{ padding: '28px 24px', transitionDelay: `${i * 0.1}s` }}>
              <div style={{ marginBottom: 14, color: 'var(--teal)' }}><item.Icon size={32} /></div>
              <div style={{ fontFamily: 'Montserrat', fontWeight: 700, fontSize: 16, color: 'var(--text)', marginBottom: 10 }}>{item.title}</div>
              <p style={{ fontFamily: 'Poppins', fontSize: 14, lineHeight: 1.7, color: 'var(--muted)', margin: 0 }}>{item.body}</p>
              <div style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(68,226,205,0.1)', border: '1px solid rgba(68,226,205,0.2)', borderRadius: 8, padding: '4px 10px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#44e2cd', display: 'inline-block' }} />
                <span style={{ fontFamily: 'Inter', fontSize: 11, color: '#44e2cd' }}>In planning</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Support section ─── */
function SupportSection() {
  const { ref, visible } = useReveal()
  return (
    <section id="support" style={{ padding: '120px 24px', background: 'var(--bg-dark)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 50%, rgba(73,0,128,0.3) 0%, transparent 65%)', pointerEvents: 'none' }} />

      <div ref={ref} style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center' }}>
        <div className={`reveal ${visible ? 'visible' : ''}`} style={{ fontFamily: 'Montserrat', fontSize: 12, fontWeight: 700, letterSpacing: 4, color: 'var(--teal)', textTransform: 'uppercase', marginBottom: 12 }}>Support</div>

        <div className={`reveal-scale ${visible ? 'visible' : ''} animate-pulse-glow`} style={{
          background: 'linear-gradient(135deg, rgba(73,0,128,0.25) 0%, rgba(183,109,255,0.1) 50%, rgba(73,0,128,0.25) 100%)',
          border: '1px solid rgba(183,109,255,0.35)', borderRadius: 28,
          padding: '60px 48px', backdropFilter: 'blur(20px)',
          transitionDelay: '0.1s',
        }}>
          <div style={{ marginBottom: 20, color: '#b76dff', display: 'flex', justifyContent: 'center' }}>
            <Heart size={44} fill="#b76dff" />
          </div>
          <h2 style={{ fontFamily: "'Bricolage Grotesque'", fontSize: 'clamp(28px,4vw,48px)', fontWeight: 800, marginBottom: 20, lineHeight: 1.15 }}>
            Help Build the Future of<br /><span className="text-gradient-purple">Campus Navigation.</span>
          </h2>
          <p style={{ fontFamily: 'Poppins', fontSize: 16, lineHeight: 1.8, color: 'var(--muted)', marginBottom: 32, maxWidth: 560, margin: '0 auto 32px' }}>
            Maps By FUTA is independently developed and maintained to improve campus life at FUTA. Community support helps expand features, improve map accuracy, add new locations, and keep the platform free for every student, forever.
          </p>
          <div className="flex flex-wrap gap-4 justify-center" style={{ marginBottom: 40 }}>
            {[
              { Icon: Map, label: 'Expand the map' }, { Icon: Zap, label: 'Faster features' },
              { Icon: Satellite, label: 'Better GPS' }, { Icon: Gift, label: 'Always free' },
            ].map(({ Icon, label }) => (
              <div key={label} style={{ background: 'rgba(183,109,255,0.12)', border: '1px solid rgba(183,109,255,0.25)', borderRadius: 10, padding: '8px 16px', fontFamily: 'Inter', fontSize: 13, color: 'var(--purple-light)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon size={14} /> {label}
              </div>
            ))}
          </div>
          <a
            href="https://www.oncrowdr.com/explore/c/fund-mapsbyfuta"
            target="_blank"
            rel="noreferrer"
            className="btn-primary"
            style={{ fontSize: 16, padding: '16px 40px' }}
          >
            <Heart size={16} fill="currentColor" /> Support Maps By FUTA
          </a>
          <p style={{ fontFamily: 'Poppins', fontSize: 13, color: 'rgba(183,109,255,0.5)', marginTop: 20 }}>
            Every contribution, no matter how small, makes a difference.
          </p>
        </div>
      </div>
    </section>
  )
}

/* ─── FAQ ─── */
function FAQ() {
  const { ref, visible } = useReveal()
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const faqs = [
    { q: 'What is Maps By FUTA?', a: 'Maps By FUTA is an interactive campus navigation platform built exclusively for the Federal University of Technology, Akure. It helps students, staff, freshers, parents, and visitors navigate the campus using intelligent search, live GPS navigation, and categorized location discovery.' },
    { q: 'Do I need to download an app?', a: 'No. Maps By FUTA is a Progressive Web App (PWA) — it runs entirely in your browser. Just visit mapsbyfuta.xyz on any device and start navigating immediately.' },
    { q: 'Is Maps By FUTA free to use?', a: 'Yes! Maps By FUTA is completely free for all students, staff, and visitors. It will always be free. Community support helps keep it that way.' },
    { q: 'How accurate is the campus map?', a: 'The map is built specifically for FUTA campus using accurate geographic data with 100+ verified locations. The team continuously updates the map as campus changes.' },
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

/* ─── Final CTA ─── */
function FinalCTA() {
  const { ref, visible } = useReveal(0.2)
  const ctaRef = useRef<SVGPathElement>(null)
  useEffect(() => {
    const el = ctaRef.current
    if (!el || !visible) return
    const len = el.getTotalLength()
    el.style.strokeDasharray = String(len)
    el.style.strokeDashoffset = String(len)
    el.style.transition = 'stroke-dashoffset 4s ease'
    setTimeout(() => { el.style.strokeDashoffset = '0' }, 300)
  }, [visible])

  return (
    <section style={{ padding: '140px 24px', background: 'var(--bg-mid)', position: 'relative', overflow: 'hidden', textAlign: 'center' }}>
      {/* Animated background */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.12, pointerEvents: 'none' }} viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#b76dff" stopOpacity="1" />
            <stop offset="100%" stopColor="#b76dff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <path ref={ctaRef} d="M 100 500 C 200 400 300 200 600 300 S 900 100 1100 200" stroke="#b76dff" strokeWidth="2" fill="none" />
        <path d="M 0 300 C 150 250 300 400 600 350 S 900 200 1200 300" stroke="#44e2cd" strokeWidth="1.5" fill="none" opacity="0.6" strokeDasharray="6 4" />
        {[200, 400, 600, 800, 1000].map((x, i) => (
          <circle key={i} cx={x} cy={100 + (i * 70) % 400} r={4 + (i % 3)} fill="#b76dff" className="animate-pulse-glow" />
        ))}
      </svg>

      {/* Orbs */}
      <div style={{ position: 'absolute', top: '10%', left: '10%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(73,0,128,0.35) 0%, transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '10%', right: '10%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(68,226,205,0.15) 0%, transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none' }} />

      <div ref={ref} style={{ position: 'relative', zIndex: 1 }}>
        <div className={`reveal ${visible ? 'visible' : ''}`} style={{ fontFamily: 'Montserrat', fontSize: 12, fontWeight: 700, letterSpacing: 4, color: 'var(--teal)', textTransform: 'uppercase', marginBottom: 20 }}>Ready?</div>
        <h2 className={`reveal ${visible ? 'visible' : ''}`} style={{ fontFamily: "'Bricolage Grotesque'", fontSize: 'clamp(36px,6vw,80px)', fontWeight: 800, lineHeight: 1.0, marginBottom: 24, letterSpacing: '-1px', transitionDelay: '0.1s' }}>
          Ready to Explore FUTA<br /><span className="text-gradient-mix">Like Never Before?</span>
        </h2>
        <p className={`reveal ${visible ? 'visible' : ''}`} style={{ fontFamily: 'Poppins', fontSize: 18, color: 'var(--muted)', marginBottom: 48, maxWidth: 500, margin: '0 auto 48px', transitionDelay: '0.2s' }}>
          Search. Navigate. Discover.<br />Experience campus differently.
        </p>
        <div className={`reveal ${visible ? 'visible' : ''}`} style={{ transitionDelay: '0.3s' }}>
          <a href="https://mapsbyfuta.xyz" target="_blank" rel="noreferrer" className="btn-primary" style={{ fontSize: 18, padding: '18px 48px', borderRadius: 18 }}>
            <Map size={18} /> Open Maps By FUTA
          </a>
        </div>
        <p className={`reveal ${visible ? 'visible' : ''}`} style={{ fontFamily: 'Poppins', fontSize: 13, color: 'rgba(183,109,255,0.45)', marginTop: 24, transitionDelay: '0.4s' }}>
          Free · No download required · Open in any browser
        </p>
      </div>
    </section>
  )
}

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
              {[
                { node: '𝕏', label: 'Twitter' },
                { node: 'in', label: 'LinkedIn' },
                { node: <Camera size={16} />, label: 'Instagram' },
                { node: <MessageCircle size={16} />, label: 'WhatsApp' },
              ].map(({ node, label }) => (
                <a key={label} href="#" aria-label={label} style={{
                  width: 40, height: 40, borderRadius: 10, background: 'rgba(34,42,61,0.6)',
                  border: '1px solid var(--border)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 14, color: 'var(--muted)',
                  textDecoration: 'none', transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(183,109,255,0.4)'; e.currentTarget.style.color = 'var(--text)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}>
                  {node}
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
            <a href="https://mapsbyfuta.xyz" target="_blank" rel="noreferrer" className="btn-primary" style={{ fontSize: 14, padding: '12px 24px' }}>
              Open Maps <ArrowRight size={14} />
            </a>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 24, display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontFamily: 'Poppins', fontSize: 13, color: 'rgba(183,109,255,0.5)', margin: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
            Made with <Heart size={13} fill="currentColor" /> for FUTA
          </p>
          <p style={{ fontFamily: 'Poppins', fontSize: 13, color: 'var(--muted)', margin: 0, opacity: 0.5 }}>
            © {new Date().getFullYear()} Maps By FUTA · All rights reserved
          </p>
          <a href="https://mapsbyfuta.xyz" target="_blank" rel="noreferrer" style={{ fontFamily: 'Inter', fontSize: 13, color: 'var(--purple-mid)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            mapsbyfuta.xyz <ExternalLink size={12} />
          </a>
        </div>
      </div>
    </footer>
  )
}

/* ─── Root ─── */
export default function App() {
  return (
    <>
      <Nav />
      <Hero />
      <TrustBar />
      <DiscoverSection />
      <ProductFeatures />
      <VideoSection />
      <WhySection />
      <ExploreSection />
      <StatsSection />
      <RoadmapSection />
      <SupportSection />
      <FinalCTA />
      <FAQ />
      <Footer />
    </>
  )
}
