import {
  Landmark, Satellite, Smartphone, Search, RadioTower, Globe,
  BadgeCheck, Zap, Map, Star, Compass, Lock,
} from 'lucide-react'

/* ─── Trust bar ─── */
function TrustBar() {
  const badges = [
    [Landmark, 'Built for FUTA'], [Satellite, 'Live Navigation'], [Smartphone, 'Mobile First'], [Search, 'Smart Search'],
    [RadioTower, 'GPS Enabled'], [Globe, 'Responsive'], [BadgeCheck, 'Campus Verified'], [Zap, 'Fast & Free'],
    [Map, 'Interactive Map'], [Star, 'Community Reviews'], [Compass, 'Turn-by-Turn'], [Lock, 'Trusted Platform'],
  ]
  const doubled = [...badges, ...badges]

  return (
    <div style={{
      background: 'rgba(19,27,46,0.8)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
      padding: '18px 0', overflow: 'hidden',
    }}>
      <div className="animate-ticker" style={{ display: 'flex', gap: 48, width: 'max-content' }}>
        {doubled.map(([BadgeIcon, label], i) => (
          <div key={i} className="flex items-center gap-2" style={{ whiteSpace: 'nowrap' }}>
            <BadgeIcon size={15} strokeWidth={2} color="var(--muted)" />
            <span style={{ fontFamily: 'Inter', fontSize: 14, fontWeight: 500, color: 'var(--muted)' }}>{label}</span>
            <span style={{ color: 'rgba(183,109,255,0.4)', fontSize: 10 }}>◆</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default TrustBar
