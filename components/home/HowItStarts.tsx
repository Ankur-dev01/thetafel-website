'use client'

import { useRef } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useInView, useScrollValue, rv } from './motion'
import s from './home.module.css'
import { box, cx } from './layout'

const steps = [
  { src: '/images/home/step-card-1.png', w: 796, h: 880, box: { x: 91, y: 452, w: 398, h: 440 }, alt: 'step1Alt', rz: -6, tx: -30, ty: 36 },
  { src: '/images/home/step-card-2.png', w: 734, h: 831, box: { x: 545, y: 442, w: 367, h: 416 }, alt: 'step2Alt', rz: 0, tx: 0, ty: 44 },
  { src: '/images/home/step-card-3.png', w: 819, h: 914, box: { x: 972, y: 447, w: 410, h: 457 }, alt: 'step3Alt', rz: 6, tx: 30, ty: 36 },
] as const

// Handoff §07 reveal windows (progress → per-step local progress).
const WINDOWS: ReadonlyArray<readonly [number, number]> = [
  [0.00, 0.20],
  [0.25, 0.45],
  [0.50, 0.70],
] as const

// Per-connector windows: each connector unwipes after both step cards it
// joins have started arriving, so it never draws itself into an empty gap.
const CONNECTOR_WINDOWS: ReadonlyArray<readonly [number, number]> = [
  [0.30, 0.50],
  [0.55, 0.75],
] as const

const localProgress = (p: number, start: number, end: number) =>
  Math.min(1, Math.max(0, (p - start) / (end - start)))

export default function HowItStarts() {
  const t = useTranslations('home.howItStarts')
  const sectionRef = useRef<HTMLElement>(null)
  const cardRefs = useRef<Array<HTMLImageElement | null>>([])
  const connectorRefs = useRef<Array<HTMLImageElement | null>>([])
  const [textRef, textIn] = useInView<HTMLDivElement>()
  const [cardsRef, cardsIn] = useInView<HTMLDivElement>({ threshold: 0.2 })

  // §07 Live by tonight: one scroll-progress timeline with three staggered
  // reveal windows (0–20%, 25–45%, 50–70%), instead of three independent
  // IntersectionObserver events. Handoff explicitly asks for "one
  // scroll-progress timeline… produces a more continuous, intentional
  // sequence." Progress is computed as the section top scrolls up past
  // 60% of the section's own height; each step / connector reads its
  // local progress into a CSS custom property. useScrollValue is desktop-
  // only and reduced-motion-aware, so below 1200px or under reduced
  // motion the fallback .rv/.rvIn reveal on cardsIn still runs.
  useScrollValue(
    sectionRef,
    (rect) => Math.min(1, Math.max(0, -rect.top / (rect.height * 0.6))),
    (progress) => {
      cardRefs.current.forEach((card, i) => {
        const window = WINDOWS[i]
        if (!card || !window) return
        card.style.setProperty('--step-p', localProgress(progress, window[0], window[1]).toFixed(4))
      })
      connectorRefs.current.forEach((line, i) => {
        const window = CONNECTOR_WINDOWS[i]
        if (!line || !window) return
        line.style.setProperty('--step-p', localProgress(progress, window[0], window[1]).toFixed(4))
      })
    }
  )

  return (
    <section id="how-it-works" ref={sectionRef} className={s.how}>
      <div className={s.stage}>
        <div ref={textRef}>
          <p
            className={cx(s.abs, s.t, s.howEyebrow, s.rv, textIn && s.rvIn)}
            style={box({ x: 216, y: 147.4, w: 1000, fs: 26.1 }, rv({ ty: 18 }))}
          >
            {t('eyebrow')}
          </p>
          <h2
            className={cx(s.abs, s.t, s.howTitle, s.rv, textIn && s.rvIn)}
            style={box({ x: 215, y: 184.5, w: 1000, fs: 98.74 }, rv({ ty: 26, delay: 80 }))}
          >
            {t('title1')} <span className={s.accentHow}>{t('title2')}</span>
          </h2>
          <p
            className={cx(s.abs, s.t, s.howSub, s.rv, textIn && s.rvIn)}
            style={box({ x: 215.5, y: 309.9, w: 1000, fs: 30.38 }, rv({ ty: 20, delay: 160 }))}
          >
            {t('sub')}
          </p>
        </div>

        <div ref={cardsRef} className={cx(s.abs, s.howCards)} style={box({ x: 0, y: 0, w: 1440, h: 1096 })}>
          {steps.map((step, i) => (
            <Image
              key={step.src}
              ref={(el) => { cardRefs.current[i] = el }}
              src={step.src}
              alt={t(step.alt)}
              width={step.w}
              height={step.h}
              sizes="(max-width: 1199px) 90vw, 410px"
              className={cx(s.abs, s.howCard, s.rv, cardsIn && s.rvIn)}
              style={box(step.box, rv({ tx: step.tx, ty: step.ty, rz: step.rz, delay: i * 150 }))}
            />
          ))}
          <Image
            ref={(el) => { connectorRefs.current[0] = el }}
            src="/images/home/connector-1.png"
            alt=""
            width={234}
            height={72}
            className={cx(s.abs, s.connector, cardsIn && s.connectorIn)}
            style={box({ x: 445, y: 591, w: 117, h: 36 }, rv({ delay: 360 }))}
          />
          <Image
            ref={(el) => { connectorRefs.current[1] = el }}
            src="/images/home/connector-2.png"
            alt=""
            width={238}
            height={92}
            className={cx(s.abs, s.connector, cardsIn && s.connectorIn)}
            style={box({ x: 891, y: 606, w: 119, h: 46 }, rv({ delay: 510 }))}
          />
        </div>
      </div>
    </section>
  )
}
