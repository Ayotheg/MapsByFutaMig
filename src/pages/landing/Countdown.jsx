import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { LAUNCH_DATE } from './shared'

function getTimeLeft() {
  const diff = LAUNCH_DATE.getTime() - Date.now()
  const clamped = Math.max(diff, 0)
  return {
    days: Math.floor(clamped / 86400000),
    hours: Math.floor((clamped / 3600000) % 24),
    minutes: Math.floor((clamped / 60000) % 60),
    seconds: Math.floor((clamped / 1000) % 60),
    done: diff <= 0,
  }
}

const UNIT_LABELS = [
  ['days', 'Days'],
  ['hours', 'Hours'],
  ['minutes', 'Min'],
  ['seconds', 'Sec'],
]

/**
 * Pre-launch countdown. Lives directly under Hero's CTA row — the same
 * spot the (now-disabled) "Open the Map" button sits — so anyone who
 * reaches for the map immediately sees why it's disabled and when
 * that changes. This is the one deliberate, strategic placement point
 * on the page; it isn't repeated elsewhere so it doesn't get lost in
 * the noise of the rest of the marketing content.
 */
function Countdown() {
  const [time, setTime] = useState(getTimeLeft)

  useEffect(() => {
    const id = setInterval(() => setTime(getTimeLeft()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      style={{
        display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        margin: '4px auto 28px', padding: '16px 28px',
        background: 'var(--land-surface)', border: '1px solid var(--land-border)',
        borderRadius: 20, boxShadow: '0 4px 24px rgba(0,0,0,0.05)',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: 12,
        letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--land-accent)',
      }}>
        <Clock size={13} strokeWidth={2.25} />
        {time.done ? "We're live" : 'Launching soon'}
      </div>

      {!time.done && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18 }}>
          {UNIT_LABELS.map(([key, label]) => (
            <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 40 }}>
              <span style={{
                fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 26,
                color: 'var(--land-text-primary)', lineHeight: 1, fontVariantNumeric: 'tabular-nums',
              }}>
                {String(time[key]).padStart(2, '0')}
              </span>
              <span style={{
                fontFamily: 'Poppins, sans-serif', fontSize: 11, color: 'var(--land-text-secondary)',
                marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.3,
              }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      )}

      <p style={{
        margin: 0, fontFamily: 'Poppins, sans-serif', fontSize: 12.5,
        color: 'var(--land-text-secondary)', textAlign: 'center', maxWidth: 260,
      }}>
        {time.done
          ? 'The map is on its way — check back shortly.'
          : "The map isn't open yet. Buttons that lead there are disabled until launch."}
      </p>
    </div>
  )
}

export default Countdown
