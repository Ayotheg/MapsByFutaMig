import { useEffect, useRef, useState } from 'react'
import { Volume2, VolumeX, TriangleAlert } from 'lucide-react'
import { useReveal } from './landingHooks'

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

// Loads the YouTube IFrame API script once and resolves with `window.YT`,
// sharing a single promise across every VideoSection instance/remount so
// the script tag never gets injected twice.
let youtubeApiPromise = null
function loadYouTubeIframeApi() {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT)
  if (youtubeApiPromise) return youtubeApiPromise

  youtubeApiPromise = new Promise((resolve) => {
    const previousReady = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previousReady === 'function') previousReady()
      resolve(window.YT)
    }
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(tag)
    }
  })
  return youtubeApiPromise
}

/* ─── Video section ─── */
function VideoSection() {
  const { ref, visible } = useReveal()
  const mountRef = useRef(null)
  const playerRef = useRef(null)
  const inViewRef = useRef(false)
  const [playerReady, setPlayerReady] = useState(false)
  const [muted, setMuted] = useState(true)
  const [loadError, setLoadError] = useState(null)

  // Create the YT player once, muted by default — browsers block unmuted
  // autoplay without a prior user gesture, so this is what makes the
  // "plays automatically on scroll" behavior actually work everywhere.
  useEffect(() => {
    if (!DEMO_VIDEO_ID) {
      setLoadError(`Couldn't read a video ID from DEMO_VIDEO_INPUT ("${DEMO_VIDEO_INPUT}") — paste a full YouTube URL or the bare 11-character ID.`)
      return
    }
    let cancelled = false
    loadYouTubeIframeApi().then((YT) => {
      if (cancelled || !YT || !mountRef.current) return
      playerRef.current = new YT.Player(mountRef.current, {
        videoId: DEMO_VIDEO_ID,
        playerVars: {
          autoplay: 0,
          mute: 1,
          controls: 1,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onReady: () => {
            setPlayerReady(true)
            if (inViewRef.current) playerRef.current.playVideo()
          },
          // Fires for invalid IDs, private/removed videos, or videos with
          // embedding disabled — the exact "pasted the wrong thing" cases
          // that otherwise fail silently.
          onError: (e) => {
            const messages = {
              2: 'Invalid video ID.',
              5: 'This video can\u2019t be played in the HTML5 player.',
              100: 'Video not found (removed or private).',
              101: 'The video owner has disabled embedding.',
              150: 'The video owner has disabled embedding.',
            }
            setLoadError(messages[e.data] || `YouTube playback error (code ${e.data}).`)
          },
        },
      })
    })
    return () => {
      cancelled = true
      playerRef.current?.destroy?.()
    }
  }, [])

  // Play once the section is meaningfully in view; pause AND rewind to 0
  // once it scrolls out, so scrolling back in always replays from the start
  // rather than resuming mid-clip.
  useEffect(() => {
    const section = document.getElementById('video')
    if (!section) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        inViewRef.current = entry.isIntersecting
        const player = playerRef.current
        if (!player || !playerReady) return
        if (entry.isIntersecting) {
          player.playVideo()
        } else {
          player.pauseVideo()
          player.seekTo(0)
        }
      },
      { threshold: 0.5 }
    )
    observer.observe(section)
    return () => observer.disconnect()
  }, [playerReady])

  const toggleMute = () => {
    const player = playerRef.current
    if (!player) return
    if (muted) {
      player.unMute()
      setMuted(false)
    } else {
      player.mute()
      setMuted(true)
    }
  }

  return (
    <section id="video" style={{ padding: '120px 24px', background: 'var(--bg-darkest)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, rgba(73,0,128,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div ref={ref} style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
        <div className={`reveal ${visible ? 'visible' : ''}`} style={{ fontFamily: 'Montserrat', fontSize: 12, fontWeight: 700, letterSpacing: 4, color: 'var(--teal)', textTransform: 'uppercase', marginBottom: 12 }}>Demo</div>
        <h2 className={`reveal ${visible ? 'visible' : ''}`} style={{ fontFamily: "'Bricolage Grotesque'", fontSize: 'clamp(30px,4vw,52px)', fontWeight: 800, marginBottom: 16, transitionDelay: '0.1s' }}>
          Watch Maps By FUTA<br /><span className="text-gradient-purple">in Action.</span>
        </h2>
        <p className={`reveal ${visible ? 'visible' : ''}`} style={{ fontFamily: 'Poppins', fontSize: 17, color: 'var(--muted)', marginBottom: 48, transitionDelay: '0.2s' }}>
          See how Maps By FUTA transforms the way students navigate campus.
        </p>

        <div className={`reveal-scale ${visible ? 'visible' : ''}`} style={{ transitionDelay: '0.25s' }}>
          <div style={{
            background: 'rgba(19,27,46,0.85)', backdropFilter: 'blur(20px)',
            border: '1px solid var(--border)', borderRadius: 28,
            padding: 8, overflow: 'hidden',
            boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
          }}>
            <div style={{
              background: '#000', borderRadius: 22, position: 'relative', overflow: 'hidden',
              // 16:9 responsive box — swap the aspect ratio here if the final
              // commercial ships in a different frame.
              aspectRatio: '16 / 9',
            }}>
              {/* The YT.Player call above replaces this div with the actual iframe */}
              <div ref={mountRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

              {loadError && (
                <div style={{
                  position: 'absolute', inset: 0, zIndex: 3, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 10, padding: '0 32px', textAlign: 'center',
                  background: 'rgba(11,19,38,0.95)',
                }}>
                  <TriangleAlert size={28} strokeWidth={2} color="#ffb95f" />
                  <div style={{ fontFamily: 'Inter', fontSize: 13, color: 'var(--muted)', maxWidth: 420, lineHeight: 1.6 }}>
                    {loadError}
                  </div>
                </div>
              )}

              {!loadError && (
                <button
                  onClick={toggleMute}
                  aria-label={muted ? 'Unmute video' : 'Mute video'}
                  style={{
                    position: 'absolute', bottom: 14, right: 14, zIndex: 2,
                    width: 40, height: 40, borderRadius: '50%',
                    background: 'rgba(11,19,38,0.75)', backdropFilter: 'blur(8px)',
                    border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: 'var(--text)', transition: 'transform 0.2s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.08)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  {muted ? <VolumeX size={18} strokeWidth={2} /> : <Volume2 size={18} strokeWidth={2} />}
                </button>
              )}
            </div>
          </div>
          <p style={{ fontFamily: 'Poppins', fontSize: 12, color: 'var(--muted)', marginTop: 14 }}>
            Plays automatically as you scroll into view · muted by default, tap the speaker to unmute
          </p>
        </div>
      </div>
    </section>
  )
}

export default VideoSection
