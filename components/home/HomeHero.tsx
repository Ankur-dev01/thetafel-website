'use client'

import { useRef } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { useModal } from '@/components/ui/ModalContext'
import { rv, useMounted, useScrollValue } from './motion'
import s from './home.module.css'
import { box, cx } from './layout'

// GSAP + ScrollTrigger prototype layer for the Hero (Umano-style
// background parallax). Registered once at module load; safe under SSR
// because `'use client'` scopes evaluation to the browser bundle. This
// layer ADDS a scrub-driven background drift on top of the existing
// motion.ts / useScrollValue system — it does not replace it.
gsap.registerPlugin(ScrollTrigger, useGSAP)

export default function HomeHero() {
  const t = useTranslations('home.hero')
  const { openModal } = useModal()
  // The hero is visible the instant the page loads, so its cinematic
  // load-in (matches the reference recording's opening beat) triggers on
  // mount rather than on scroll — see the reference reveal at 0–1s.
  const mounted = useMounted()
  const inCls = cx(s.rv, mounted && s.rvIn)
  const d = (delay: number) => rv({ delay })
  const spacerRef = useRef<HTMLDivElement>(null)
  const heroRef = useRef<HTMLElement>(null)
  const bgRef = useRef<HTMLImageElement>(null)

  // Desktop: the hero pins to the top of the viewport for the extra scroll
  // room .heroSpacer adds, and that distance is normalized to progress 0→1
  // and read by descendants via `--hero-progress` — driving phone/tile/
  // headline parallax with different factors per layer, per handoff §01.
  // Uses the standalone `translate`/`scale`/`rotate` CSS properties so the
  // parallax composes with (rather than fights) the mount-in reveal's own
  // `transform`. useScrollValue is desktop-only and reduced-motion-aware.
  useScrollValue(
    spacerRef,
    () => {
      const spacer = spacerRef.current
      const hero = heroRef.current
      if (!spacer || !hero) return 0
      const spacerRect = spacer.getBoundingClientRect()
      const heroHeight = hero.getBoundingClientRect().height
      const total = Math.max(1, spacerRect.height - heroHeight)
      return Math.min(1, Math.max(0, -spacerRect.top / total))
    },
    (progress) => {
      heroRef.current?.style.setProperty('--hero-progress', progress.toFixed(4))
    }
  )

  // GSAP prototype: background image slow drift as a distinct depth
  // layer under the hand/phone, headline and tiles — the "background
  // moves at a slower rate" motion cue from the Umano reference. Scrub
  // is 1:1 with scroll so reverse-scroll is naturally smooth and there
  // are no autoplay loops. `gsap.matchMedia` gates on the same
  // (≥1200px, no-preference) window the rest of the desktop-only motion
  // uses, so mobile/tablet and reduced-motion users see the bg entirely
  // static. useGSAP scopes the tween to this component and handles
  // cleanup on unmount / HMR.
  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add('(min-width: 1200px) and (prefers-reduced-motion: no-preference)', () => {
        if (!bgRef.current || !spacerRef.current) return
        gsap.fromTo(
          bgRef.current,
          { yPercent: 0 },
          {
            yPercent: -8,
            ease: 'none',
            scrollTrigger: {
              trigger: spacerRef.current,
              start: 'top top',
              end: 'bottom bottom',
              scrub: true,
              invalidateOnRefresh: true,
            },
          },
        )
      })
    },
    { scope: heroRef },
  )

  return (
    <div ref={spacerRef} className={s.heroSpacer}>
      <section id="hero" ref={heroRef} className={s.heroOuter}>
        <div className={s.hero}>
          <Image
            ref={bgRef}
            src="/images/home/hero-bg.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className={cx(s.cover, s.heroBgSlack)}
            data-testid="hero-bg"
          />
          <div className={s.stage}>
            <Image
              src="/images/home/tile-left.png"
              alt=""
              width={618}
              height={618}
              className={cx(s.abs, s.tile, s.tileLeft, inCls)}
              style={box({ x: -104.6, y: 543, w: 309, h: 309 }, d(600))}
            />
            <h1 className={cx(s.abs, s.t, s.heroTitle, inCls)} style={box({ x: 191, y: 176.2, w: 1000, fs: 56.13 }, d(0))}>
              {t('title')}
            </h1>
            <p className={cx(s.abs, s.t, s.heroSub, inCls)} style={box({ x: 203, y: 255.5, w: 1000, fs: 24 }, d(150))}>
              {t('sub')}
            </p>
            <div className={cx(s.abs, s.heroCtas, inCls)} style={box({ x: 578, y: 317 }, d(300))}>
              <button type="button" onClick={openModal} className={cx(s.btn, s.btnWhite, s.heroBtn, s.heroBtnPrimary)}>
                {t('ctaPrimary')}
              </button>
              <a href="#pricing" className={cx(s.btn, s.btnOrange, s.heroBtn, s.heroBtnSecondary)}>
                {t('ctaSecondary')}
              </a>
            </div>
            <Image
              src="/images/home/hero-phone.png"
              alt={t('phoneAlt')}
              width={2122}
              height={1414}
              priority
              sizes="(max-width: 1199px) 100vw, 1061px"
              className={cx(s.abs, s.heroPhone, inCls)}
              style={box({ x: 161, y: 337, w: 1061, h: 707 }, rv({ ty: 32, sc: 0.97, delay: 450 }))}
            />
          </div>
        </div>

        <div className={s.heroOverlay} aria-hidden="true">
          <div className={s.stage}>
            <Image
              src="/images/home/tile-top-right.png"
              alt=""
              width={655}
              height={660}
              className={cx(s.abs, s.tile, s.tileTr, inCls)}
              style={box({ x: 1236.3, y: 47.4, w: 327.4, h: 330 }, d(700))}
            />
            <Image
              src="/images/home/tile-br.png"
              alt=""
              width={610}
              height={610}
              className={cx(s.abs, s.tile, s.tileBr, inCls)}
              style={box({ x: 1251.6, y: 900.6, w: 305, h: 305 }, d(800))}
            />
          </div>
        </div>
      </section>
    </div>
  )
}
