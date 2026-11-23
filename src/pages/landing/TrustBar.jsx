import {
  MapPin, Wallet, Satellite, Compass, Camera, Star,
} from 'lucide-react'

/* ─── Trust bar ───
 * Light-theme rebuild (Slice 4). Trimmed from 12 vague adjective
 * badges ("Mobile First", "Responsive", "Trusted Platform" — none of
 * which are checkable claims) down to 6 concrete, real things about
 * the product. Also dropped the exact "Built for FUTA" duplicate,
 * since that's already the Hero's badge text one scroll away.
 */
function TrustBar() {
  const badges = [
    [MapPin, '475+ locations mapped'],
    [Wallet, 'Free, no download'],
    [Satellite, 'Live GPS navigation'],
    [Compass, 'Turn-by-turn directions'],
    [Camera, 'Recent destination photos'],
    [Star, 'Community reviews'],
  ]
  const doubled = [...badges, ...badges]

  return (
    <div style={{
      background: 'var(--land-surface-alt)', borderTop: '0.5px solid var(--land-border)', borderBottom: '0.5px solid var(--land-border)',
      padding: '16px 0', overflow: 'hidden',
    }}>
      <div className="animate-ticker" style={{ display: 'flex', gap: 40, width: 'max-content' }}>
        {doubled.map(([BadgeIcon, label], i) => (
          <div key={i} className="flex items-center gap-2" style={{ whiteSpace: 'nowrap' }}>
            <BadgeIcon size={14} strokeWidth={2} color="var(--land-accent)" />
            <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: 13, fontWeight: 500, color: 'var(--land-text-secondary)' }}>{label}</span>
            <span style={{ color: 'var(--land-accent-tint-border)', fontSize: 10 }}>&#9670;</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default TrustBar
