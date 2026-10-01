'use client'

import { useRef } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useInView, useScrollValue, rv } from './motion'
import s from './home.module.css'
import { box, cx } from './layout'
import { TafelBrandMark } from './svgs'

export default function BrandOwnership() {
  const t = useTranslations('home')
  const sectionRef = useRef<HTMLElement>(null)
  const markParallaxRef = useRef<HTMLDivElement>(null)
  const [markRef, markIn] = useInView<HTMLDivElement>({ threshold: 0.3 })
  const [textRef, textIn] = useInView<HTMLDivElement>()
  const [cardsRef, cardsIn] = useInView<HTMLDivElement>({ threshold: 0.15 })

  // §05 TAFEL logo bridge: the giant mark is the cinematic bridge from
  // the light product sections into the dark Guest List story. A slow
  // scroll-linked parallax (0.20× coefficient, capped ~80px within the
  // handoff's 60–120px range) reads closer to the reference recording's
  // "held" drift than a hard position:sticky pin — the mark holds while
  // Ownership content scrolls up around it.
  useScrollValue(
    sectionRef,
    (rect) => Math.min(400, Math.max(0, -rect.top)),
    (value) => {
      markParallaxRef.current?.style.setProperty('transform', `translateY(${(value * 0.2).toFixed(2)}px)`)
    }
  )

  return (
    <section id="ownership" ref={sectionRef} className={s.brand}>
      <div className={s.stage}>
        <div className={cx(s.abs, s.brandMarkBox)} style={box({ x: 394.6, y: 217, w: 648.2, h: 583.1 })}>
          {/* Parallax layer: plain inline transform set imperatively by JS
             (see useScrollValue above), kept free of any class-based
             transform so it never fights the reveal layer's own transition. */}
          <div
            ref={markParallaxRef}
            data-testid="brand-mark-parallax"
            className={s.brandMarkParallax}
            style={{ width: '100%', height: '100%' }}
          >
            <div
              ref={markRef}
              role="img"
              aria-label={t('brandMark')}
              className={cx(s.brandMark, s.rv, markIn && s.rvIn)}
              style={{ width: '100%', height: '100%', ...rv({ sc: 0.75, delay: 0, dur: 1200 }) }}
            >
              <TafelBrandMark style={{ width: '100%', height: '100%' }} />
            </div>
          </div>
        </div>

        <div ref={textRef}>
          <p
            className={cx(s.abs, s.t, s.ownEyebrow, s.rv, textIn && s.rvIn)}
            style={box({ x: 214, y: 1193, w: 1000, fs: 29.23 }, rv({ ty: 18 }))}
          >
            {t('ownership.eyebrow')}
          </p>
          <h2
            className={cx(s.abs, s.t, s.ownTitle, s.rv, textIn && s.rvIn)}
            style={box({ x: 216, y: 1243.8, w: 1000, fs: 98.74, lh: 99 }, rv({ ty: 26, delay: 80 }))}
          >
            {t('ownership.title1')}
            <br />
            {t('ownership.title2')} <span className={s.accentOwn}>{t('ownership.title3')}</span>
          </h2>
          <p
            className={cx(s.abs, s.t, s.ownSub, s.rv, textIn && s.rvIn)}
            style={box({ x: 499, y: 1468.8, w: 470, fs: 30.38, lh: 30.6 }, rv({ ty: 20, delay: 160 }))}
          >
            {t('ownership.sub')}
          </p>
        </div>

        {/* §06 Guest List cards: asymmetric depth per handoff — cards land
           at non-zero rest rotations (-2°/0°/+2°) via the standalone
           `rotate` CSS property, which composes with .rv's `transform`
           rather than fighting it. The rv `rz` deltas are the incremental
           rotation applied over the reveal on top of that rest angle. */}
        <div ref={cardsRef} className={cx(s.abs, s.ownCards)} style={box({ x: 0, y: 0, w: 1440, h: 2123 })}>
          <Image
            src="/images/home/own-card-1.png"
            alt={t('ownership.card1Alt')}
            width={894}
            height={1032}
            sizes="(max-width: 1199px) 37vw, 447px"
            className={cx(s.abs, s.ownCard1, s.rv, cardsIn && s.rvIn)}
            style={box({ x: 88, y: 1351, w: 447, h: 516 }, { ...rv({ tx: -60, ty: 50, rz: -4, delay: 0 }), rotate: '-2deg' })}
          />
          <Image
            src="/images/home/own-card-2.png"
            alt={t('ownership.card2Alt')}
            width={666}
            height={835}
            sizes="(max-width: 1199px) 28vw, 333px"
            className={cx(s.abs, s.ownCard2, s.rv, cardsIn && s.rvIn)}
            style={box({ x: 594, y: 1587, w: 333, h: 418 }, rv({ ty: 80, rz: 4, delay: 140 }))}
          />
          <Image
            src="/images/home/own-card-3.png"
            alt={t('ownership.card3Alt')}
            width={872}
            height={1018}
            sizes="(max-width: 1199px) 36vw, 436px"
            className={cx(s.abs, s.ownCard3, s.rv, cardsIn && s.rvIn)}
            style={box({ x: 938, y: 1331, w: 436, h: 509 }, { ...rv({ tx: 70, ty: 40, rz: 5, delay: 280 }), rotate: '2deg' })}
          />
        </div>
      </div>
    </section>
  )
}
