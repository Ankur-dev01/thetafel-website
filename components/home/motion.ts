'use client'

import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'

/**
 * Motion helpers for the homepage. Built on IntersectionObserver + native
 * scroll/rAF — no animation library is added, matching the codebase's
 * existing reveal-on-scroll convention (see components/sections/Problem.tsx
 * and friends). Every hook here resolves to the "already visible, no
 * animation" state when the user has requested reduced motion.
 */

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * True once the observed element has scrolled into view (fires once by
 * default). Used to trigger the one-shot reveal transitions defined by the
 * `.rv` / `.rvIn` classes in home.module.css.
 */
export function useInView<T extends Element>(options: {
  threshold?: number
  rootMargin?: string
  once?: boolean
} = {}): [RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null)
  // Lazy initializer (not a setState call in the effect body) so reduced
  // motion resolves straight to "already visible" with no cascading render.
  const [inView, setInView] = useState(() => prefersReducedMotion())
  const { threshold = 0.2, rootMargin = '0px 0px -10% 0px', once = true } = options

  useEffect(() => {
    if (prefersReducedMotion()) return
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true)
            if (once) observer.disconnect()
          } else if (!once) {
            setInView(false)
          }
        })
      },
      { threshold, rootMargin }
    )
    observer.observe(el)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return [ref, inView]
}

/**
 * True from the frame after mount onward. Used for the hero's cinematic
 * load-in (headline/sub/CTA/phone/tiles), which should play immediately
 * rather than waiting for a scroll-triggered intersection.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])
  return mounted
}

/** Inline custom-property style consumed by the shared `.rv` reveal class. */
export function rv(vars: {
  tx?: number
  ty?: number
  rz?: number
  sc?: number
  delay?: number
  dur?: number
}): CSSProperties {
  const out: Record<string, string> = {}
  if (vars.tx !== undefined) out['--tx'] = `${vars.tx}px`
  if (vars.ty !== undefined) out['--ty'] = `${vars.ty}px`
  if (vars.rz !== undefined) out['--rz'] = `${vars.rz}deg`
  if (vars.sc !== undefined) out['--sc'] = `${vars.sc}`
  if (vars.delay !== undefined) out['--rd'] = `${vars.delay}ms`
  if (vars.dur !== undefined) out['--rdur'] = `${vars.dur}ms`
  return out as CSSProperties
}

/**
 * Calls `apply(compute(rect))` on every animation frame while `targetRef`'s
 * element intersects the viewport (so idle sections cost nothing). Reads
 * `compute`/`apply` from a ref each frame so callers can pass fresh inline
 * closures without retriggering the effect. No-ops below `minWidth` or when
 * reduced motion is requested — callers own the static/CSS fallback.
 */
export function useScrollValue(
  targetRef: RefObject<HTMLElement | null>,
  compute: (rect: DOMRect) => number,
  apply: (value: number) => void,
  minWidth = 1200
) {
  const computeRef = useRef(compute)
  const applyRef = useRef(apply)
  useEffect(() => {
    computeRef.current = compute
    applyRef.current = apply
  })

  useEffect(() => {
    const el = targetRef.current
    if (!el) return
    const mq = window.matchMedia(`(min-width: ${minWidth}px) and (prefers-reduced-motion: no-preference)`)
    let frame = 0
    let active = false

    const update = () => {
      frame = 0
      if (!active || !mq.matches) return
      applyRef.current(computeRef.current(el.getBoundingClientRect()))
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }

    const io = new IntersectionObserver(
      (entries) => {
        active = entries[0]?.isIntersecting ?? false
        if (active) schedule()
      },
      { rootMargin: '25% 0px 25% 0px' }
    )
    io.observe(el)

    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    mq.addEventListener('change', schedule)
    schedule()

    return () => {
      if (frame) cancelAnimationFrame(frame)
      io.disconnect()
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      mq.removeEventListener('change', schedule)
    }
  }, [targetRef, minWidth])
}
