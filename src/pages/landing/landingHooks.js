import { useState, useEffect, useRef } from 'react'

/* ─── Scroll reveal hook ─── */
export function useReveal(threshold = 0.15) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

/* ─── Self-drawing route path hook ───
 * Animates an SVG path's stroke-dashoffset from full length to 0 on
 * mount, for the recurring "route completing itself" motif (Motion/UX
 * rules). Shared by Hero's decorative background path and
 * VideoSection's card motif so the behavior/timing stays identical
 * everywhere it's used. Respects prefers-reduced-motion by skipping
 * straight to the drawn end-state with no transition.
 */
export function useDrawRoute({ duration = 2600, delay = 300 } = {}) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const len = el.getTotalLength()
    // Deliberately NOT setting strokeDasharray here (Slice 11 fix). This
    // hook is used by RouteMotif, whose path has a dotted "2 10" pattern
    // set via its own `strokeDasharray` attribute. Overwriting it to a
    // single value equal to the path length is the standard trick for
    // animating a *solid* line drawing itself in, but it replaces the
    // dotted pattern with one giant dash — so after the animation
    // finished, the "dotted route" motif was rendering as a near-solid
    // line instead of staying dotted. Only strokeDashoffset needs to
    // move (from `len` down to 0); that slides the existing dot pattern
    // into place without touching what the pattern itself looks like.

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      el.style.strokeDashoffset = '0'
      return
    }

    el.style.strokeDashoffset = String(len)
    el.style.transition = `stroke-dashoffset ${duration}ms ease ${delay}ms`
    // Double rAF so the browser paints the offset state before the
    // transition to 0 kicks off — a single rAF (or none) sometimes
    // ships the same frame and the animation silently no-ops.
    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => { el.style.strokeDashoffset = '0' })
    })
    return () => cancelAnimationFrame(raf1)
  }, [duration, delay])
  return ref
}

/* ─── Counter hook ─── */
export function useCounter(target, suffix = '', active = false) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!active) return
    let start = 0
    const duration = 2000
    const step = duration / target
    const timer = setInterval(() => {
      start += Math.ceil(target / 60)
      if (start >= target) { setCount(target); clearInterval(timer) }
      else setCount(start)
    }, step)
    return () => clearInterval(timer)
  }, [active, target])
  return `${count}${suffix}`
}
