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
