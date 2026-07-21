/* ─── Trust bar ─── */
function TrustBar() {
  const badges = [
    '🏛️ Built for FUTA', '📡 Live Navigation', '📱 Mobile First', '🔍 Smart Search',
    '🛰️ GPS Enabled', '🌐 Responsive', '✅ Campus Verified', '⚡ Fast & Free',
    '🗺️ Interactive Map', '⭐ Community Reviews', '🧭 Turn-by-Turn', '🔒 Trusted Platform',
  ]
  const doubled = [...badges, ...badges]

  return (
    <div style={{
      background: 'rgba(19,27,46,0.8)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
      padding: '18px 0', overflow: 'hidden',
    }}>
      <div className="animate-ticker" style={{ display: 'flex', gap: 48, width: 'max-content' }}>
        {doubled.map((badge, i) => (
          <div key={i} className="flex items-center gap-2" style={{ whiteSpace: 'nowrap' }}>
            <span style={{ fontFamily: 'Inter', fontSize: 14, fontWeight: 500, color: 'var(--muted)' }}>{badge}</span>
            <span style={{ color: 'rgba(183,109,255,0.4)', fontSize: 10 }}>◆</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default TrustBar
