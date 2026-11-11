import { useEffect, useRef, useState } from 'react'
import { Play, X } from 'lucide-react'

// Filename is uppercase on disk; Vercel paths are case-sensitive.
const TUTORIAL_SRC = '/tutorial.MP4'
const DISMISS_KEY = 'tutorialDismissed'

/* ─── Floating install tutorial ───
 * Vertical video card pinned to the bottom-right once the Hero has
 * scrolled out of view. Silent preview loops there; tap restarts it with
 * sound and controls. preload="metadata" keeps the video file off the
 * network for visitors who never scroll past the Hero. Dismissal lasts
 * for the tab session so it doesn't nag on every scroll.
 */
function TutorialVideo() {
  const videoRef = useRef(null)
  const [pastHero, setPastHero] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [inPip, setInPip] = useState(false)
  const [leaving, setLeaving] = useState(false)
  // Read after mount, not in the initializer: the prerendered HTML always
  // has the card, so reading storage during render breaks hydration.
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    try { if (sessionStorage.getItem(DISMISS_KEY) === '1') setDismissed(true) } catch { /* private mode */ }
  }, [])

  useEffect(() => {
    const hero = document.getElementById('about')
    if (!hero) return
    const io = new IntersectionObserver(([entry]) => setPastHero(!entry.isIntersecting))
    io.observe(hero)
    return () => io.disconnect()
  }, [])

  // React has no PiP events. Fallback for browsers that ignore
  // disablePictureInPicture: hide the empty card while PiP is open.
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const enter = () => setInPip(true)
    const leave = () => setInPip(false)
    const webkitMode = () => setInPip(v.webkitPresentationMode === 'picture-in-picture')
    v.addEventListener('enterpictureinpicture', enter)
    v.addEventListener('leavepictureinpicture', leave)
    v.addEventListener('webkitpresentationmodechanged', webkitMode)
    return () => {
      v.removeEventListener('enterpictureinpicture', enter)
      v.removeEventListener('leavepictureinpicture', leave)
      v.removeEventListener('webkitpresentationmodechanged', webkitMode)
    }
  }, [])

  // Heading to the map in this tab: fade out right away instead of riding
  // along over the map's loading screen. New-tab clicks leave it alone.
  useEffect(() => {
    const onClick = (e) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      if (!e.target.closest?.('a[href="/map"]')) return
      videoRef.current?.pause()
      setLeaving(true)
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  // Fully stop playback when the page goes away. A video in iOS PiP or
  // fullscreen otherwise keeps playing after its element is removed.
  useEffect(() => {
    const v = videoRef.current
    return () => {
      if (!v) return
      v.pause()
      try {
        if (document.pictureInPictureElement === v) document.exitPictureInPicture()
        if (v.webkitPresentationMode && v.webkitPresentationMode !== 'inline') v.webkitSetPresentationMode('inline')
        if (document.fullscreenElement === v) document.exitFullscreen()
        if (v.webkitDisplayingFullscreen) v.webkitExitFullscreen()
      } catch { /* not in PiP/fullscreen */ }
      v.removeAttribute('src')
      v.load()
    }
  }, [])

  // Stay on screen while playing even if the user scrolls back up.
  const shown = (pastHero || playing) && !inPip && !leaving

  // Muted looping preview once the card appears (browsers only allow
  // muted autoplay). Skipped for Save-Data / reduced-motion visitors.
  useEffect(() => {
    const v = videoRef.current
    if (!v || playing) return
    const quiet = navigator.connection?.saveData
      || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (shown && !quiet) v.play().catch(() => {})
    else v.pause()
  }, [shown, playing])

  if (dismissed) return null

  const play = () => {
    const v = videoRef.current
    if (!v) return
    setPlaying(true)
    v.muted = false
    v.loop = false
    v.currentTime = 0
    v.play().catch(() => {})
  }

  // Back to the silent preview, or the preview effect would restart the
  // finished video with sound.
  const finish = () => {
    const v = videoRef.current
    if (v) {
      v.muted = true
      v.loop = true
    }
    setPlaying(false)
  }

  const dismiss = () => {
    videoRef.current?.pause()
    setDismissed(true)
    try { sessionStorage.setItem(DISMISS_KEY, '1') } catch { /* private mode */ }
  }

  return (
    <aside
      className={`tutorial-float ${shown ? 'visible' : ''} ${playing ? 'playing' : ''}`}
      aria-label="How to install Maps By FUTA"
      aria-hidden={!shown}
      inert={!shown}
    >
      <button onClick={dismiss} className="tutorial-close" aria-label="Close tutorial video">
        <X size={14} strokeWidth={2.25} />
      </button>

      <div className="tutorial-frame">
        <video
          ref={videoRef}
          src={`${TUTORIAL_SRC}#t=0.1`}
          preload="metadata"
          muted
          loop
          playsInline
          // iOS moves the video into a PiP window on fullscreen exit,
          // leaving this card as an empty black box.
          disablePictureInPicture
          controls={playing}
          onEnded={finish}
        />

        {!playing && (
          <button onClick={play} className="tutorial-play" aria-label="Play install tutorial">
            <span className="play-pulse tutorial-play-icon">
              <Play size={18} strokeWidth={2} fill="currentColor" style={{ marginLeft: 2 }} />
            </span>
            <span className="tutorial-label">How to install</span>
          </button>
        )}
      </div>
    </aside>
  )
}

export default TutorialVideo
