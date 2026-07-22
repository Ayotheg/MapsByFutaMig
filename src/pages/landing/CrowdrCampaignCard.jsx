import { useState } from 'react'
import { ArrowUpRight } from 'lucide-react'

const CROWDR_CAMPAIGN_URL = 'https://www.oncrowdr.com/explore/c/fund-mapsbyfuta'

/**
 * Live Crowdr campaign preview — build-plan Task 6, v1 (iframe embed).
 * No public Crowdr API or embed widget exists, so this is a plain
 * <iframe> sized to sit as natively as possible inside SupportSection's
 * glass card. Built as its own file per the build plan so it's swappable
 * for a v2 (serverless-fetched, brand-styled numbers) later without
 * touching the rest of SupportSection.
 *
 * ⚠️ UNVERIFIED — this environment has no way to inspect Crowdr's response
 * headers, so I could not confirm whether they set X-Frame-Options or a
 * CSP frame-ancestors rule that blocks being framed (exactly the risk the
 * build plan calls out). Open the landing page in a real browser and
 * check: if the card below renders the actual campaign, you're good. If
 * it stays blank/grey after loading, Crowdr is blocking the frame and
 * this needs the fallback link (already in place below) promoted to the
 * primary CTA, or the v2 serverless approach from the build plan instead.
 */
function CrowdrCampaignCard({ campaignUrl = CROWDR_CAMPAIGN_URL }) {
  const [loaded, setLoaded] = useState(false)

  return (
    <div style={{ width: '100%', maxWidth: 480, margin: '0 auto 32px' }}>
      <div style={{
        position: 'relative', borderRadius: 20, overflow: 'hidden',
        border: '1px solid rgba(183,109,255,0.3)',
        background: '#fff',
        boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
      }}>
        {!loaded && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(11,19,38,0.9)', zIndex: 1,
          }}>
            <div className="animate-spin-fast" style={{
              width: 28, height: 28, borderRadius: '50%',
              border: '3px solid rgba(183,109,255,0.25)', borderTopColor: '#b76dff',
            }} />
          </div>
        )}
        <iframe
          src={campaignUrl}
          title="Fund Maps By FUTA — Crowdr campaign"
          onLoad={() => setLoaded(true)}
          loading="lazy"
          style={{ display: 'block', width: '100%', height: 480, border: 'none' }}
        />
      </div>

      {/* Fallback: always present, not just an error state — covers the
          "iframe rendered blank due to frame-ancestors block" case, which
          doesn't reliably fire a JS error event to detect programmatically. */}
      <a
        href={campaignUrl}
        target="_blank"
        rel="noreferrer"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          marginTop: 10, fontFamily: 'Inter', fontSize: 12.5, color: 'var(--muted)',
          textDecoration: 'none',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--purple-light)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
      >
        Trouble viewing the campaign? Open it on Crowdr <ArrowUpRight size={13} strokeWidth={2} />
      </a>
    </div>
  )
}

export default CrowdrCampaignCard
