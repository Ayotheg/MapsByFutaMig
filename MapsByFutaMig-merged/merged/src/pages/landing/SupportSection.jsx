import { Heart, Map, Zap, Satellite, Gift } from 'lucide-react'
import { useReveal } from './landingHooks'
import CrowdrCampaignCard from './CrowdrCampaignCard'

/* ─── Support section ─── */
function SupportSection() {
  const { ref, visible } = useReveal()
  return (
    <section id="support" style={{ padding: '120px 24px', background: 'var(--bg-dark)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 50%, rgba(68,226,205,0.1) 0%, transparent 65%)', pointerEvents: 'none' }} />

      <div ref={ref} style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center' }}>
        <div className={`reveal ${visible ? 'visible' : ''}`} style={{ fontFamily: 'Montserrat', fontSize: 12, fontWeight: 700, letterSpacing: 4, color: 'var(--teal)', textTransform: 'uppercase', marginBottom: 12 }}>Support</div>

        <div className={`reveal-scale ${visible ? 'visible' : ''}`} style={{
          background: 'var(--surface-container)',
          border: '1px solid rgba(68,226,205,0.25)', borderRadius: 28,
          padding: '60px 48px', backdropFilter: 'blur(20px)',
          transitionDelay: '0.1s',
        }}>
          <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'center' }}><Heart size={44} strokeWidth={2} color="#44e2cd" fill="#44e2cd" /></div>
          <h2 style={{ fontFamily: "'Bricolage Grotesque'", fontSize: 'clamp(28px,4vw,48px)', fontWeight: 800, marginBottom: 20, lineHeight: 1.15 }}>
            Help Build the Future of<br /><span className="text-gradient-teal">Campus Navigation.</span>
          </h2>
          <p style={{ fontFamily: 'Poppins', fontSize: 16, lineHeight: 1.8, color: 'var(--muted)', marginBottom: 32, maxWidth: 560, margin: '0 auto 32px' }}>
            Maps By FUTA is independently developed and maintained to improve campus life at FUTA. Community support helps expand features, improve map accuracy, add new locations, and keep the platform free for every student, forever.
          </p>
          <div className="flex flex-wrap gap-4 justify-center" style={{ marginBottom: 40 }}>
            {[[Map, 'Expand the map'], [Zap, 'Faster features'], [Satellite, 'Better GPS'], [Gift, 'Always free']].map(([ItemIcon, label]) => (
              <div key={label} style={{ background: 'rgba(68,226,205,0.1)', border: '1px solid rgba(68,226,205,0.25)', borderRadius: 10, padding: '8px 16px', fontFamily: 'Inter', fontSize: 13, color: 'var(--teal)', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <ItemIcon size={14} strokeWidth={2} /> {label}
              </div>
            ))}
          </div>
          <CrowdrCampaignCard />
          <p style={{ fontFamily: 'Poppins', fontSize: 13, color: 'var(--muted)', marginTop: 20 }}>
            Every contribution, no matter how small, makes a difference.
          </p>
        </div>
      </div>
    </section>
  )
}

export default SupportSection
