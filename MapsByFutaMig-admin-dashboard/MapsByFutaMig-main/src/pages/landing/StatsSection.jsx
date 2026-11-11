import { useReveal, useCounter } from './landingHooks'

/* ─── Statistics ─── */
function StatCard({ value, label, suffix = '', active, color }) {
  const display = useCounter(value, suffix, active)
  return (
    <div className="text-center" style={{ padding: '20px 10px' }}>
      <div style={{ fontFamily: "'Bricolage Grotesque'", fontSize: 'clamp(40px,5vw,68px)', fontWeight: 800, lineHeight: 1, color }}>
        {active ? display : `0${suffix}`}
      </div>
      <div style={{ fontFamily: 'Poppins', fontSize: 15, color: 'var(--muted)', marginTop: 8 }}>{label}</div>
    </div>
  )
}

function StatsSection() {
  const { ref, visible } = useReveal(0.3)
  const stats = [
    { value: 475, suffix: '+', label: 'Campus Locations', color: 'var(--purple-light)' },
    { value: 20, suffix: '+', label: 'Categories', color: 'var(--teal)' },
    { value: 1, suffix: '', label: 'Campus. Fully Mapped.', color: 'var(--orange)' },
    { value: 5000, suffix: '+', label: 'Searches Made', color: 'var(--teal)' },
  ]

  return (
    <section style={{ padding: '100px 24px', background: 'var(--bg-darkest)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, rgba(73,0,128,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div ref={ref} style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div className={`reveal ${visible ? 'visible' : ''}`} style={{ textAlign: 'center', marginBottom: 60 }}>
          <h2 style={{ fontFamily: "'Bricolage Grotesque'", fontSize: 'clamp(28px,3.5vw,46px)', fontWeight: 800, color: 'var(--text)' }}>
            Numbers That <span className="text-gradient-teal">Speak for Themselves.</span>
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

export default StatsSection
