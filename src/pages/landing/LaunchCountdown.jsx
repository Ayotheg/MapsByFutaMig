import { Clock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useReveal } from './landingHooks'

/* ─── Launch countdown ───
 * Sits directly under the Hero, ahead of TrustBar — the first thing a
 * new visitor scrolls into, on purpose, so the "we're launching soon"
 * message lands before anything else competes for attention.
 *
 * ██ EDIT ME — LAUNCH_DATE ██
 * This is the single source of truth for every number this section
 * renders. To change how many days/hours are shown, just update the
 * date/time below (interpreted in the visitor's own local timezone —
 * no timezone math needed on our end). Everything else recalculates
 * automatically, including once the date has passed (see note below).
 */
const LAUNCH_DATE = new Date('2026-09-15T09:00:00')

function getTimeLeft() {
  const diffMs = LAUNCH_DATE.getTime() - Date.now()
  const clamped = Math.max(0, diffMs)
  return {
    days: Math.floor(clamped / (1000 * 60 * 60 * 24)),
    hours: Math.floor((clamped / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((clamped / (1000 * 60)) % 60),
    seconds: Math.floor((clamped / 1000) % 60),
    isPast: diffMs <= 0,
  }
}

function LaunchCountdown() {
  const { ref, visible } = useReveal(0.2)
  const [timeLeft, setTimeLeft] = useState(getTimeLeft)

  useEffect(() => {
    // NOTE: once LAUNCH_DATE is reached every unit just holds at 00 —
    // this section doesn't auto-hide itself or swap copy on expiry.
    // If the map goes live before someone remembers to update/remove
    // this section, bump LAUNCH_DATE above or pull <LaunchCountdown />
    // out of LandingPage.jsx.
    const timer = setInterval(() => setTimeLeft(getTimeLeft()), 1000)
    return () => clearInterval(timer)
  }, [])

  const units = [
    { value: timeLeft.days, label: 'Days' },
    { value: timeLeft.hours, label: 'Hours' },
    { value: timeLeft.minutes, label: 'Min' },
    { value: timeLeft.seconds, label: 'Sec' },
  ]

  return (
    <section
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(180deg, var(--land-accent-tint-bg) 0%, var(--land-surface) 100%)',
        borderTop: '1px solid var(--land-border)',
        borderBottom: '1px solid var(--land-border)',
        padding: 'clamp(72px, 12vw, 140px) 24px',
      }}
    >
      <div
        ref={ref}
        className={`reveal ${visible ? 'visible' : ''}`}
        style={{ maxWidth: 920, margin: '0 auto', textAlign: 'center' }}
      >
        {/* Eyebrow — the only copy in this section, per spec */}
        <div
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'var(--land-surface)', border: '1px solid var(--land-accent-tint-border)',
            borderRadius: 'var(--land-radius-pill)', padding: '8px 20px', marginBottom: 44,
          }}
        >
          <Clock size={15} strokeWidth={2.25} color="var(--land-accent)" />
          <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: 14, fontWeight: 600, color: 'var(--land-accent)' }}>
            Launching in...
          </span>
        </div>

        {/* Big numbers — this is the section, essentially */}
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 'clamp(24px, 6vw, 64px)' }}>
          {units.map((u) => (
            <div key={u.label} style={{ minWidth: 84 }}>
              <div
                style={{
                  fontFamily: "'Bricolage Grotesque', sans-serif",
                  fontWeight: 800,
                  fontSize: 'clamp(56px, 10vw, 128px)',
                  lineHeight: 1,
                  color: 'var(--land-text-primary)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {String(u.value).padStart(2, '0')}
              </div>
              <div
                style={{
                  fontFamily: 'Montserrat, sans-serif',
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: 3,
                  textTransform: 'uppercase',
                  color: 'var(--land-text-muted)',
                  marginTop: 10,
                }}
              >
                {u.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default LaunchCountdown
