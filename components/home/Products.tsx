'use client'

import { useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useInView, useScrollValue, rv } from './motion'
import s from './home.module.css'
import { box, cx } from './layout'
import ProductCard from './ProductCard'

export default function Products() {
  const t = useTranslations('home.products')
  const spacerRef = useRef<HTMLDivElement>(null)
  const productsRef = useRef<HTMLElement>(null)
  const railRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<Array<HTMLDivElement | null>>([])
  const [headingRef, headingIn] = useInView<HTMLDivElement>()
  const [resRef, resIn] = useInView<HTMLDivElement>({ threshold: 0.25 })

  // Desktop: Products pins to the top of the viewport for the extra scroll
  // room `.productsSpacer` adds (see home.module.css), and that scroll
  // distance drives the mini-card rail sideways — reproducing the
  // reference recording's pinned horizontal-rail behaviour (7–12.5s) rather
  // than shifting the rail while the section merely scrolls past.
  useScrollValue(
    spacerRef,
    () => {
      const spacer = spacerRef.current
      const sticky = productsRef.current
      if (!spacer || !sticky) return 0
      const spacerRect = spacer.getBoundingClientRect()
      const stickyHeight = sticky.getBoundingClientRect().height
      const total = Math.max(1, spacerRect.height - stickyHeight)
      return Math.min(1, Math.max(0, -spacerRect.top / total))
    },
    (progress) => {
      const rail = railRef.current
      const viewportEl = rail?.parentElement
      if (!rail || !viewportEl) return
      const max = Math.max(0, rail.scrollWidth - viewportEl.clientWidth)
      rail.style.setProperty('--shift', `${-progress * max}px`)

      // Continuous focus-scale from each card's actual on-screen distance
      // to the rail's center, rather than a 3-way threshold snap — the
      // scale tracks the same transform driving --shift, so it settles
      // exactly as a card centers instead of jumping between two states.
      const viewportRect = viewportEl.getBoundingClientRect()
      const center = viewportRect.left + viewportRect.width / 2
      cardRefs.current.forEach((card) => {
        if (!card) return
        const rect = card.getBoundingClientRect()
        const distance = Math.abs(rect.left + rect.width / 2 - center)
        const falloff = Math.min(1, distance / rect.width)
        card.style.setProperty('--fscale', (1 - falloff * 0.06).toFixed(4))
      })
    }
  )

  return (
    <>
      <div ref={spacerRef} className={s.productsSpacer}>
        <section id="products" ref={productsRef} className={s.products}>
          <span id="solution" className={s.anchor} aria-hidden="true" />
          <div className={s.stage}>
            <div ref={headingRef}>
              <h2
                className={cx(s.abs, s.t, s.productsTitle, s.rv, headingIn && s.rvIn)}
                style={box({ x: 0, y: 98.2, w: 1440, fs: 64 }, rv({ ty: 20 }))}
              >
                {t('title')}
              </h2>
              <p
                className={cx(s.abs, s.t, s.productsSub, s.rv, headingIn && s.rvIn)}
                style={box({ x: 0, y: 172.2, w: 1440, fs: 47.42 }, rv({ ty: 20, delay: 90 }))}
              >
                {t('sub')}
              </p>
            </div>
            <div className={cx(s.abs, s.railViewport)} style={box({ x: 0, y: 322, w: 1440, h: 420 })}>
              <div ref={railRef} data-testid="products-rail" className={s.rail}>
                {(['reservations', 'qr', 'takeaway'] as const).map((variant, i) => (
                  <div key={variant} ref={(el) => { cardRefs.current[i] = el }} className={s.railCard}>
                    <ProductCard variant={variant} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      <section id="reservations" className={s.reservations}>
        <div className={s.stage}>
          {/* §04 Reservations: `tx: 60` connects the reveal back to the
             preceding feature rail (which released rightward). Kept subtle
             per the handoff — the section is a product-demo moment, not
             another storytelling scene. */}
          <div
            ref={resRef}
            className={cx(s.abs, s.reservationsCard, s.rv, resIn && s.rvIn)}
            style={box({ x: 0, y: 0, w: 1447 }, rv({ tx: 60, ty: 50, sc: 0.97 }))}
          >
            <ProductCard variant="reservations" large />
          </div>
        </div>
      </section>
    </>
  )
}
