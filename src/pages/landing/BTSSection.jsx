import { useEffect, useRef, useState } from 'react'
import { Film, ExternalLink, TriangleAlert } from 'lucide-react'
import { useReveal } from './landingHooks'

/**
 * Paste the URL of YOUR quote-tweet post here (not the original tweet
 * you're quoting) — X renders the quoted post nested inside it
 * automatically, so one link gets you both. Any form works: full
 * status URL on x.com or twitter.com, or the bare numeric post ID.
 * This is the one line to change each time a new build-log post goes
 * up, same pattern as DEMO_VIDEO_INPUT in VideoSection.jsx.
 */
const BTS_POST_INPUT = 'https://twitter.com/AyotheGrapher_/status/2092871359734935630'

function extractPostId(input) {
  if (!input) return null
  const trimmed = input.trim()
  if (/^\d+$/.test(trimmed)) return trimmed
  try {
    const url = new URL(trimmed)
    if (!/(^|\.)(x|twitter)\.com$/.test(url.hostname)) return null
    const match = url.pathname.match(/\/status\/(\d+)/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

const BTS_POST_ID = extractPostId(BTS_POST_INPUT)

// Link shown under the embed — point this at the profile or a search/
// hashtag URL where every build-log post in the series lives, so people
// aren't stuck at just the one post.
const BTS_FOLLOW_URL = 'https://x.com/AyotheGrapher_'

/* ─── X widgets.js loader ───
 * Only ever injects the script once, even across remounts/HMR — every
 * later call re-resolves the same promise. Mirrors the "load an
 * external embed script on demand" approach VideoSection uses for its
 * YouTube iframe, just for X's widget script instead. Using
 * twttr.widgets.createTweet() (mount into a ref) rather than the raw
 * blockquote+load() approach avoids a flash of plain-text blockquote
 * before the script finishes parsing it.
 */
function loadTwitterWidgets() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'))
  if (window.twttr?.widgets) return Promise.resolve(window.twttr)
  if (window.__twttrWidgetsPromise) return window.__twttrWidgetsPromise

  window.__twttrWidgetsPromise = new Promise((resolve, reject) => {
    const resolveWhenReady = () => {
      if (window.twttr?.widgets) {
        resolve(window.twttr)
      } else {
        reject(new Error('Twitter widgets did not initialize'))
      }
    }
    const existing = document.querySelector('script[src="https://platform.twitter.com/widgets.js"]')
    if (existing) {
      existing.addEventListener('load', () => {
        if (window.twttr?.ready) window.twttr.ready(resolveWhenReady)
        else resolveWhenReady()
      }, { once: true })
      existing.addEventListener('error', reject)
      if (window.twttr?.ready) window.twttr.ready(resolveWhenReady)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://platform.twitter.com/widgets.js'
    script.async = true
    script.onload = () => {
      if (window.twttr?.ready) window.twttr.ready(resolveWhenReady)
      else resolveWhenReady()
    }
    script.onerror = reject
    document.body.appendChild(script)
  })

  return window.__twttrWidgetsPromise
}

/* ─── Behind the Scenes ───
 * Sits after the main pitch and immediately before the FAQ: visitors
 * get proof that the build is actively happening before the common
 * questions — a quote-tweet from the build-log
 * vlog series, embedded live via X's widget rather than a screenshot
 * so it stays current (edits/replies/like counts) and is verifiably
 * real. Card treatment (surface/border/radius/shadow) matches
 * VideoSection's embed card for visual consistency between the two
 * "external embed" sections on the page.
 */
function BTSSection() {
  const { ref, visible } = useReveal()
  const embedRef = useRef(null)
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'

  useEffect(() => {
    if (!BTS_POST_ID) {
      setStatus('error')
      return
    }
    let cancelled = false

    loadTwitterWidgets()
      .then((twttr) => {
        if (cancelled || !embedRef.current) return null
        embedRef.current.innerHTML = ''
        return twttr.widgets.createTweet(BTS_POST_ID, embedRef.current, {
          theme: 'light',
          dnt: true,
          align: 'center',
        })
      })
      .then((el) => {
        if (cancelled) return
        setStatus(el ? 'ready' : 'error')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section id="bts" style={{ padding: '100px 24px 50px', background: 'var(--land-surface-alt)' }}>
      <div ref={ref} style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
        <div
          className={`reveal ${visible ? 'visible' : ''}`}
          
        >
          
        </div>

        <h2
          className={`reveal ${visible ? 'visible' : ''}`}
          style={{
            fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800,
            fontSize: 'clamp(28px,3.5vw,44px)', color: 'var(--land-text-primary)',
            margin: 0, marginBottom: 16, transitionDelay: '0.1s',
          }}
        >
          Behind the scenes.
        </h2>
        <p
          className={`reveal ${visible ? 'visible' : ''}`}
          style={{
            fontFamily: 'Poppins, sans-serif', fontSize: 15, lineHeight: 1.6,
            color: 'var(--land-text-secondary)', marginBottom: 40, transitionDelay: '0.2s',
            maxWidth: 520, marginLeft: 'auto', marginRight: 'auto',
          }}
        >
          We're vlogging the build in public — design calls, bugs, campus
          data collection, all of it. Here's the latest from the series.
        </p>

        <div className={`reveal-scale ${visible ? 'visible' : ''}`} style={{ transitionDelay: '0.25s' }}>
          <div
            style={{
              position: 'relative', overflow: 'hidden',
              background: 'var(--land-surface)', border: '1px solid var(--land-border)',
              borderRadius: 'var(--land-radius-card)',
              minHeight: status === 'ready' ? undefined : 220,
              padding: status === 'ready' ? 20 : '32px 20px',
              boxShadow: '0 20px 50px rgba(20,10,40,0.08)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {status === 'loading' && (
              <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: 13, color: 'var(--land-text-muted)' }}>
                Loading the latest post…
              </div>
            )}

            {status === 'error' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, maxWidth: 420 }}>
                <TriangleAlert size={26} strokeWidth={2} color="#c77b1f" />
                <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: 13, color: 'var(--land-text-secondary)', lineHeight: 1.6 }}>
                  {BTS_POST_ID
                    ? "Couldn't load that post — it may have been deleted, or X's embed script didn't load."
                    : `Couldn't read a post ID from BTS_POST_INPUT ("${BTS_POST_INPUT}") — paste a full x.com status URL or the bare numeric ID.`}
                </div>
                <a
                  href={BTS_FOLLOW_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  style={{
                    fontFamily: 'Poppins, sans-serif', fontSize: 13, fontWeight: 600,
                    color: 'var(--land-accent)', textDecoration: 'none',
                  }}
                >
                  View it on X instead →
                </a>
              </div>
            )}

            {/* twttr.widgets.createTweet mounts the real embed iframe here. */}
            <div ref={embedRef} style={{ width: '100%', display: status === 'ready' ? 'flex' : 'none', justifyContent: 'center' }} />
          </div>

          <a
            href={BTS_FOLLOW_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="pill-btn"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 24,
              fontFamily: 'Poppins, sans-serif', fontSize: 14, fontWeight: 600,
              color: '#fff', background: 'var(--land-accent)',
              borderRadius: 'var(--land-radius-pill)', padding: '12px 24px',
              textDecoration: 'none',
            }}
          >
            <Film size={16} strokeWidth={2.25} />
            Follow the build series
            <ExternalLink size={14} strokeWidth={2.25} />
          </a>
        </div>
      </div>
    </section>
  )
}

export default BTSSection
