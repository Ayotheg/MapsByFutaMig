import { useState } from 'react'
import { Play, TriangleAlert } from 'lucide-react'
import { useReveal } from './landingHooks'
import { RouteMotif } from './shared'

/**
 * Real footage is too large to push through GitHub, so the commercial is
 * hosted on YouTube instead of shipped as a local <video> file. Paste
 * EITHER the full YouTube URL (any form: watch?v=, youtu.be/, /embed/,
 * /shorts/) OR the bare 11-character video ID here — extractYouTubeId()
 * below normalizes whichever you give it, so this is the one line to
 * change once the real commercial is uploaded.
 */
const DEMO_VIDEO_INPUT = 'https://youtu.be/Lofi1jha6s8?si=ik4bBl8_avCwhSiO'

// YouTube's `videoId` player param wants the bare 11-char ID, not a URL —
// pasting a full link in directly is a common, silent failure mode (the
// player just never loads, no console error). This accepts either.
function extractYouTubeId(input) {
  if (!input) return null
  const trimmed = input.trim()
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed
  try {
    const url = new URL(trimmed)
    if (url.hostname.includes('youtu.be')) {
      const id = url.pathname.slice(1).split('/')[0]
      return /^[\w-]{11}$/.test(id) ? id : null
    }
    if (url.hostname.includes('youtube.com')) {
      const v = url.searchParams.get('v')
      if (v && /^[\w-]{11}$/.test(v)) return v
      const match = url.pathname.match(/\/(?:embed|shorts)\/([\w-]{11})/)
      if (match) return match[1]
    }
  } catch {
    // Not a URL and not a bare ID either — falls through to null below.
  }
  return null
}

const DEMO_VIDEO_ID = extractYouTubeId(DEMO_VIDEO_INPUT)

const CHAPTERS = [
  '0:05 Search a building',
  '0:20 Get directions',
  '0:45 Explore campus',
]

/* ─── Video section ───
 * Light-theme rebuild (Slice 9) — replaces the old always-loaded YouTube
 * IFrame API + IntersectionObserver play/pause/rewind/mute-toggle setup
 * with a plain facade: a static poster (YouTube's own thumbnail CDN, no
 * extra fetch/SDK needed for it) with a play button on top. Nothing
 * YouTube-related loads until the button is clicked, at which point a
 * plain <iframe> (not the JS API) is mounted with autoplay=1 — safe
 * because the click itself is the user gesture browsers require for
 * unmuted autoplay. This removes the entire observer/mute-toggle logic;
 * there's nothing left to observe or mute.
 */
function VideoSection() {
  const { ref, visible } = useReveal()
  const [playing, setPlaying] = useState(false)
  const [posterFallback, setPosterFallback] = useState(false)

  const posterSrc = DEMO_VIDEO_ID
    ? `https://img.youtube.com/vi/${DEMO_VIDEO_ID}/${posterFallback ? 'hqdefault' : 'maxresdefault'}.jpg`
    : null

  return (
    <section id="video" style={{ padding: '120px 24px', background: 'var(--land-bg)' }}>
      <div ref={ref} style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
        <div
          className={`reveal ${visible ? 'visible' : ''}`}
          style={{
            fontFamily: 'Montserrat, sans-serif', fontSize: 12, fontWeight: 700,
            letterSpacing: 3, color: 'var(--land-accent)', textTransform: 'uppercase',
            marginBottom: 12,
          }}
        >
          The story
        </div>
        <h2
          className={`reveal ${visible ? 'visible' : ''}`}
          style={{
            fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800,
            fontSize: 'clamp(28px,3.5vw,44px)', color: 'var(--land-text-primary)',
            margin: 0, marginBottom: 16, transitionDelay: '0.1s',
          }}
        >
          See it in action.
        </h2>
        <p
          className={`reveal ${visible ? 'visible' : ''}`}
          style={{
            fontFamily: 'Poppins, sans-serif', fontSize: 15, lineHeight: 1.6,
            color: 'var(--land-text-secondary)', marginBottom: 48, transitionDelay: '0.2s',
          }}
        >
          A 60-second look at searching, directions, and campus exploration.
        </p>

        <div className={`reveal-scale ${visible ? 'visible' : ''}`} style={{ transitionDelay: '0.25s' }}>
          <div
            style={{
              position: 'relative', overflow: 'hidden',
              background: 'var(--land-surface)', border: '1px solid var(--land-border)',
              borderRadius: 'var(--land-radius-card)',
              aspectRatio: '16 / 9',
              boxShadow: '0 20px 50px rgba(20,10,40,0.08)',
            }}
          >
            {/* Same route motif as Hero, low-opacity, for visual continuity between sections */}
            <RouteMotif
              opacity={0.08}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0 }}
            />

            {!DEMO_VIDEO_ID && (
              <div style={{
                position: 'absolute', inset: 0, zIndex: 2, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 10, padding: '0 32px', textAlign: 'center',
              }}>
                <TriangleAlert size={28} strokeWidth={2} color="#c77b1f" />
                <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: 13, color: 'var(--land-text-secondary)', maxWidth: 420, lineHeight: 1.6 }}>
                  Couldn't read a video ID from DEMO_VIDEO_INPUT ("{DEMO_VIDEO_INPUT}") — paste a full YouTube URL or the bare 11-character ID.
                </div>
              </div>
            )}

            {DEMO_VIDEO_ID && !playing && (
              <button
                onClick={() => setPlaying(true)}
                aria-label="Play video"
                style={{
                  position: 'absolute', inset: 0, zIndex: 1, width: '100%', height: '100%',
                  border: 'none', padding: 0, cursor: 'pointer', background: 'none',
                }}
              >
                <img
                  src={posterSrc}
                  onError={() => setPosterFallback(true)}
                  alt="Maps By FUTA demo video preview"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,6,20,0.18)' }} />
                <span
                  className="play-pulse pill-btn"
                  style={{
                    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                    width: 68, height: 68, borderRadius: '50%',
                    background: 'var(--land-accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 8px 24px rgba(20,10,40,0.28)',
                  }}
                >
                  <Play size={26} strokeWidth={2} fill="#fff" color="#fff" style={{ marginLeft: 3 }} />
                </span>
              </button>
            )}

            {DEMO_VIDEO_ID && playing && (
              <iframe
                src={`https://www.youtube.com/embed/${DEMO_VIDEO_ID}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
                title="Maps By FUTA demo video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', zIndex: 1 }}
              />
            )}
          </div>

          {/* Static chapter labels — not real scrubbing controls, just a preview of what's covered */}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 18 }}>
            {CHAPTERS.map((label) => (
              <span
                key={label}
                style={{
                  fontFamily: 'Poppins, sans-serif', fontSize: 12, color: 'var(--land-text-secondary)',
                  background: 'var(--land-surface-alt)', border: '1px solid var(--land-border)',
                  borderRadius: 'var(--land-radius-pill)', padding: '6px 14px',
                }}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default VideoSection
