'use client'

import type { CSSProperties } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useModal } from '@/components/ui/ModalContext'
import { TIER_MONTHLY_CENTS } from '@/lib/pricing/subscription'
import { useInView, rv } from './motion'
import s from './home.module.css'
import { box, cbox, cx, type Box } from './layout'

const euro = (cents: number) => `€${Math.round(cents / 100)}`

type Text = { value: string; box: Box; color: string }

type CardSpec = {
  key: string
  wrap: Box
  base: [number, number]
  bg: { src: string; w: number; h: number; box: Box }
  num: Text
  name: Text
  price: Text
  tags: Text & { lines: [string, string] }
  badge?: { value: string; box: Box }
}

export default function Pricing() {
  const t = useTranslations('home.pricing')
  const { openModal } = useModal()
  const [headingRef, headingIn] = useInView<HTMLDivElement>()
  const [gridRef, gridIn] = useInView<HTMLDivElement>({ threshold: 0.15 })
  const [footRef, footIn] = useInView<HTMLDivElement>()

  const cards: CardSpec[] = [
    {
      key: 'starter',
      wrap: { x: 54, y: 323.7, w: 312.8 },
      base: [312.8, 397.3],
      bg: { src: '/images/home/pricing-1.png', w: 626, h: 795, box: { x: 0, y: 0, w: 312.8, h: 397.3 } },
      num: { value: '01', box: { x: 29, y: 31, fs: 17 }, color: '#aaaaaa' },
      name: { value: t('starter'), box: { x: 30, y: 65, fs: 31 }, color: '#ffffff' },
      price: { value: euro(TIER_MONTHLY_CENTS.starter), box: { x: 28, y: 104.8, fs: 62 }, color: '#ffffff' },
      tags: { value: '', lines: [t('starterTag1'), t('starterTag2')], box: { x: 30, y: 183.7, fs: 12, lh: 22 }, color: '#aaaaaa' },
    },
    {
      key: 'plus',
      wrap: { x: 389.8, y: 323.7, w: 312.8 },
      base: [312.8, 397.4],
      bg: { src: '/images/home/pricing-2.png', w: 626, h: 795, box: { x: 0, y: 0, w: 312.8, h: 397.4 } },
      num: { value: '02', box: { x: 28.2, y: 23, fs: 17 }, color: '#777777' },
      name: { value: t('plus'), box: { x: 30.2, y: 58.1, fs: 31 }, color: '#111111' },
      price: { value: euro(TIER_MONTHLY_CENTS.plus), box: { x: 27.2, y: 97.8, fs: 62 }, color: '#111111' },
      tags: { value: '', lines: [t('plusTag1'), t('plusTag2')], box: { x: 29.2, y: 185.7, fs: 12, lh: 22 }, color: '#555555' },
    },
    {
      key: 'premium',
      wrap: { x: 725.6, y: 318, w: 321.6 },
      base: [321.6, 408.7],
      bg: { src: '/images/home/pricing-3.png', w: 714, h: 888, box: { x: -17.6, y: -18.6, w: 356.8, h: 443.9 } },
      // #ff9a68/#c9a996 below are picked for contrast against this card's
      // background photo (pricing-3.png), not brand accents — intentionally
      // left off the --tafel-primary-* token ramp.
      num: { value: '03', box: { x: 22.4, y: 26.8, fs: 16 }, color: '#ff9a68' },
      name: { value: t('premium'), box: { x: 24.4, y: 57, fs: 29.23 }, color: '#ffffff' },
      price: { value: euro(TIER_MONTHLY_CENTS.premium), box: { x: 22.4, y: 96, fs: 58.47 }, color: '#ffffff' },
      tags: { value: '', lines: [t('premiumTag1'), t('premiumTag2')], box: { x: 23.4, y: 174.8, fs: 11.32, lh: 20.7 }, color: '#c9a996' },
      badge: { value: t('mostPopular'), box: { x: 174.2, y: 357.1, w: 130.3, h: 37 } },
    },
    {
      key: 'enterprise',
      wrap: { x: 1070.2, y: 320.8, w: 308.7 },
      base: [308.7, 403.1],
      bg: { src: '/images/home/pricing-4.png', w: 617, h: 806, box: { x: 0, y: 0, w: 308.7, h: 403.1 } },
      num: { value: '04', box: { x: 15.8, y: 25.9, fs: 17 }, color: '#aaaaaa' },
      name: { value: t('enterprise'), box: { x: 17.8, y: 53, fs: 31 }, color: '#ffffff' },
      price: { value: t('custom'), box: { x: 16.8, y: 92.7, fs: 58.47 }, color: '#ffffff' },
      tags: { value: '', lines: [t('enterpriseTag1'), t('enterpriseTag2')], box: { x: 15.8, y: 167.6, fs: 12, lh: 22 }, color: '#aaaaaa' },
    },
  ]

  return (
    <section id="pricing" className={s.pricing}>
      <span id="proof" className={s.anchor} aria-hidden="true" />
      <div className={s.stage}>
        <div ref={headingRef}>
          <p
            className={cx(s.abs, s.t, s.pricingEyebrow, s.rv, headingIn && s.rvIn)}
            style={box({ x: 220, y: 94.4, w: 1000, fs: 19.3 }, rv({ ty: 16 }))}
          >
            {t('eyebrow')}
          </p>
          <h2
            className={cx(s.abs, s.t, s.pricingTitle, s.rv, headingIn && s.rvIn)}
            style={box({ x: 220, y: 124.8, w: 1000, fs: 82 }, rv({ ty: 24, delay: 80 }))}
          >
            {t('title')} <span className={s.accentPrice}>{euro(TIER_MONTHLY_CENTS.starter)}.</span>
          </h2>
          <p
            className={cx(s.abs, s.t, s.pricingSub, s.rv, headingIn && s.rvIn)}
            style={box({ x: 220, y: 223.7, w: 1000, fs: 24 }, rv({ ty: 18, delay: 160 }))}
          >
            {t('sub')}
          </p>
        </div>

        <div ref={gridRef} className={cx(s.abs, s.priceGrid)} style={box({ x: 0, y: 0, w: 1440, h: 974 })}>
          {cards.map((card, i) => (
            // Featured (premium) card gets a slightly more pronounced
            // scale reveal per handoff §08 ("Featured card sc 0.97→1
            // — very subtle emphasis"); other cards use the shared ty:50
            // per handoff ("ty 50–90 → 0, stagger ~0.08–0.14 progress"),
            // realized here as an 110ms delay stagger.
            <div
              key={card.key}
              className={cx(s.abs, s.priceWrap, s.rv, gridIn && s.rvIn)}
              style={box(card.wrap, rv({ ty: 50, sc: card.key === 'premium' ? 0.94 : 0.97, delay: i * 110 }))}
            >
              <div
                className={s.priceCard}
                style={{ '--base': card.base[0], '--ar': `${card.base[0]} / ${card.base[1]}` } as CSSProperties}
              >
                <Image
                  src={card.bg.src}
                  alt=""
                  width={card.bg.w}
                  height={card.bg.h}
                  sizes="(max-width: 1199px) 50vw, 360px"
                  className={s.ca}
                  style={cbox(card.bg.box)}
                />
                <p className={cx(s.ca, s.ct, s.priceNum)} style={cbox(card.num.box, { color: card.num.color })}>
                  {card.num.value}
                </p>
                <h3 className={cx(s.ca, s.ct, s.priceName)} style={cbox(card.name.box, { color: card.name.color })}>
                  {card.name.value}
                </h3>
                <p className={cx(s.ca, s.ct, s.pricePrice)} style={cbox(card.price.box, { color: card.price.color })}>
                  {card.price.value}
                </p>
                <p className={cx(s.ca, s.ct, s.priceTags)} style={cbox(card.tags.box, { color: card.tags.color })}>
                  {card.tags.lines[0]}
                  <br />
                  {card.tags.lines[1]}
                </p>
                {card.badge && (
                  <span className={cx(s.ca, s.priceBadge)} style={cbox(card.badge.box)}>
                    {card.badge.value}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div ref={footRef} className={cx(s.abs, s.pricingFoot)} style={box({ x: 0, y: 0, w: 1440, h: 974 })}>
          <p
            className={cx(s.abs, s.t, s.pricingNote, s.rv, footIn && s.rvIn)}
            style={box({ x: 71, y: 776.3, w: 240, fs: 20, lh: 24 }, rv({ ty: 16 }))}
          >
            {t('ownData1')}
            <br />
            {t('ownData2')}
          </p>
          <button
            type="button"
            onClick={openModal}
            className={cx(s.abs, s.btn, s.seeAll, s.rv, footIn && s.rvIn)}
            style={box({ x: 585, y: 763, w: 271, h: 72 }, rv({ ty: 16, sc: 0.94, delay: 80 }))}
          >
            {t('seeAll')}
          </button>
          <p
            className={cx(s.abs, s.t, s.pricingNote, s.pricingNoteRight, s.rv, footIn && s.rvIn)}
            style={box({ x: 1138, y: 787.3, w: 240, fs: 20, lh: 24 }, rv({ ty: 16, delay: 160 }))}
          >
            {t('rules1')}
            <br />
            {t('rules2')}
          </p>
        </div>
      </div>
    </section>
  )
}
