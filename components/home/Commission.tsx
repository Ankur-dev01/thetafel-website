'use client'

import { Fragment, useMemo, useRef } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useInView, useScrollValue, rv } from './motion'
import s from './home.module.css'
import { box, cx } from './layout'

export default function Commission() {
  const t = useTranslations('home.commission')
  const [ref, inView] = useInView<HTMLDivElement>()
  const spacerRef = useRef<HTMLDivElement>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const wordRefs = useRef<Array<HTMLSpanElement | null>>([])

  const sub = t('sub')
  // Split the sub into whitespace-delimited words. Empty entries from
  // consecutive spaces are filtered so refs align 1:1 with rendered spans.
  const words = useMemo(() => sub.split(/\s+/).filter(Boolean), [sub])

  // Desktop: pin the section for the extra scroll distance in
  // .commissionSpacer, and normalize that to progress 0→1 (handoff §02
  // pinned scene). Descendants read `--comm-progress` and derive the
  // scroll-linked card rotation (+8°→-6°), scale (0.92→1) and
  // translateY (80→0) via standalone `translate/rotate/scale`, which
  // compose with the existing .rv mount-in transform rather than
  // fighting it. useScrollValue is desktop-only and reduced-motion-aware.
  //
  // The same progress also drives an Umano-style word-by-word darken on
  // the sub (`--word-p` 0→1 per span; CSS maps that to opacity). Under
  // reduced motion / below 1200px, `useScrollValue` no-ops and the CSS
  // media guards ensure spans stay at full readable opacity.
  useScrollValue(
    spacerRef,
    () => {
      const spacer = spacerRef.current
      const section = sectionRef.current
      if (!spacer || !section) return 0
      const spacerRect = spacer.getBoundingClientRect()
      const sectionHeight = section.getBoundingClientRect().height
      const total = Math.max(1, spacerRect.height - sectionHeight)
      return Math.min(1, Math.max(0, -spacerRect.top / total))
    },
    (progress) => {
      sectionRef.current?.style.setProperty('--comm-progress', progress.toFixed(4))

      // Per-word local progress. Reveal window opens at 15% of section
      // progress and closes at 75%, giving ~60% of the pinned scroll
      // range for the whole sub to darken. Each word's own window is
      // staggered by its index — later words start slightly later but
      // overlap generously so the sentence "wakes up" as a flow rather
      // than reading like a slot machine.
      const nodes = wordRefs.current
      const n = nodes.length
      if (n === 0) return
      const revealStart = 0.15
      const revealSpan = 0.60
      const perWordWindow = 0.22 // each word darkens across ~22% progress
      const step = (revealSpan - perWordWindow) / Math.max(1, n - 1)
      for (let i = 0; i < n; i++) {
        const el = nodes[i]
        if (!el) continue
        const start = revealStart + i * step
        const p = Math.min(1, Math.max(0, (progress - start) / perWordWindow))
        el.style.setProperty('--word-p', p.toFixed(3))
      }
    }
  )

  return (
    <div ref={spacerRef} className={s.commissionSpacer}>
      <section id="commission" ref={sectionRef} className={s.commission}>
        <div className={s.commissionBg} aria-hidden="true" />
        <div ref={ref} className={s.stage}>
          <h2
            className={cx(s.abs, s.t, s.commissionTitle, s.rv, inView && s.rvIn)}
            style={box({ x: 64, y: 257.7, w: 560, fs: 86.03, lh: 85 }, rv({ ty: 30 }))}
          >
            {t('title1')}
            <br />
            {t('title2')}
          </h2>
          <p
            className={cx(s.abs, s.t, s.commissionSub, s.rv, inView && s.rvIn)}
            style={box({ x: 66, y: 460.5, w: 330, fs: 24, lh: 25 }, rv({ ty: 22, delay: 100 }))}
            data-testid="commission-sub"
          >
            {words.map((word, i) => (
              <Fragment key={i}>
                {i > 0 ? ' ' : null}
                <span
                  ref={(el) => { wordRefs.current[i] = el }}
                  className={s.commissionSubWord}
                >
                  {word}
                </span>
              </Fragment>
            ))}
          </p>
          <Image
            src="/images/home/commission-cards.png"
            alt={t('cardsAlt')}
            width={1760}
            height={1348}
            sizes="(max-width: 1199px) 100vw, 880px"
            className={cx(s.abs, s.commissionCards, s.rv, inView && s.rvIn)}
            style={box({ x: 560, y: 102, w: 880, h: 674 }, rv({ ty: 40, rz: -4, sc: 0.92, delay: 150, dur: 950 }))}
          />
        </div>
      </section>
    </div>
  )
}
