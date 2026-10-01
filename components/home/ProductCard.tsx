'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import s from './home.module.css'
import { cbox, cx } from './layout'
import { ArrowIcon, CalendarIcon, ClockIcon, TafelMark } from './svgs'

type Variant = 'reservations' | 'qr' | 'takeaway'

/**
 * Product card from the Figma "Everything the house needs" rail. The same
 * layout is used at full width for the Reservations section. Card-local
 * coordinates come from the 1421x908 (QR/Takeaway) and 1447x924.6
 * (Reservations) Figma frames and scale with the card width.
 */
export default function ProductCard({ variant, large = false }: { variant: Variant; large?: boolean }) {
  if (variant === 'reservations') return <ReservationsCard large={large} />
  return <PhoneCard variant={variant} />
}

function ReservationsCard({ large }: { large: boolean }) {
  const t = useTranslations('home.products.reservations')

  return (
    <article className={s.pcWrap}>
      <div className={cx(s.pc, s.pcRes)}>
        <Image
          src={large ? '/images/home/reservations-bg.png' : '/images/home/product-card-bg.png'}
          alt=""
          fill
          sizes={large ? '100vw' : '(max-width: 1199px) 86vw, 607px'}
          className={s.pcBg}
        />
        <p className={cx(s.ca, s.ct, s.pcLabel)} style={cbox({ x: 76.3, y: 57.9, fs: 38.13, lh: 31 })}>
          <TafelMark className={s.pcMark} />
          {t('label')}
        </p>
        <h3 className={cx(s.ca, s.ct, s.pcTitle)} style={cbox({ x: 67, y: 179.2, w: 600, fs: 95.32, lh: 99 })}>
          {t('title1')}
          <br />
          {t('title2')}
        </h3>
        <p className={cx(s.ca, s.ct, s.pcBody)} style={cbox({ x: 78, y: 430.9, w: 380, fs: 25.85, lh: 31 })}>
          {t('body')}
        </p>

        <div className={cx(s.ca, s.wg)} style={cbox({ x: 679.1, y: 114.4, w: 722 })} aria-hidden="true">
          <div className={s.wgInner}>
            <CalendarIcon className={cx(s.wa, s.wgIcon)} style={cbox({ x: 44.5, y: 79.2, w: 41, h: 39.9 })} />
            <p className={cx(s.wa, s.wt, s.wgLabel)} style={cbox({ x: 106.1, y: 88.7, fs: 25 })}>
              {t('selectDay')}
            </p>
            {(['day1', 'day2', 'day3', 'day4'] as const).map((key, i) => (
              <span
                key={key}
                className={cx(s.wa, s.wgChip, i === 1 && s.wgChipActive)}
                style={cbox({ x: 35.5 + i * 166.8, y: 143.3, w: 154.3, h: 63.5 })}
              >
                {t(key)}
              </span>
            ))}
            <ClockIcon className={cx(s.wa, s.wgIcon)} style={cbox({ x: 44.5, y: 287.9, w: 42.6, h: 38.4 })} />
            <p className={cx(s.wa, s.wt, s.wgLabel)} style={cbox({ x: 106.1, y: 294.9, fs: 25 })}>
              {t('selectTime')}
            </p>
            {['18:00', '18:30', '19:00', '19:30'].map((time, i) => (
              <span
                key={time}
                className={cx(s.wa, s.wgChip, i === 2 && s.wgChipOutline)}
                style={cbox({ x: 35.5 + i * 166.8, y: 352, w: 154.3, h: 63.5 })}
              >
                {time}
              </span>
            ))}
            <span className={cx(s.wa, s.wgConfirm)} style={cbox({ x: 31, y: 474.2, w: 655.3, h: 92.9 })}>
              {t('confirm')}
            </span>
            <ArrowIcon className={cx(s.wa, s.wgArrow)} style={cbox({ x: 607.1, y: 499.8, w: 41.7, h: 36.9 })} />
          </div>
        </div>
      </div>
    </article>
  )
}

function PhoneCard({ variant }: { variant: 'qr' | 'takeaway' }) {
  const t = useTranslations(`home.products.${variant}`)
  const labelX = variant === 'qr' ? 68 : 67
  const titleY = variant === 'qr' ? 159.6 : 162.6

  return (
    <article className={s.pcWrap}>
      <div className={s.pc}>
        <Image
          src="/images/home/product-card-bg.png"
          alt=""
          fill
          sizes="(max-width: 1199px) 86vw, 607px"
          className={s.pcBg}
        />
        <p className={cx(s.ca, s.ct, s.pcLabel)} style={cbox({ x: labelX, y: 59.5, fs: 36.2, lh: 31 })}>
          <TafelMark className={s.pcMark} />
          {t('label')}
        </p>
        <h3 className={cx(s.ca, s.ct, s.pcTitle)} style={cbox({ x: 63, y: titleY, w: 560, fs: 93.6, lh: 97.2 })}>
          {t('title1')}
          <br />
          {t('title2')}
          <br />
          {t('title3')}
        </h3>
        <p className={cx(s.ca, s.ct, s.pcBody)} style={cbox({ x: 64, y: 504.6, w: 340, fs: 32, lh: 41 })}>
          {t('body')}
        </p>
        <Image
          src={`/images/home/phone-card-${variant}.png`}
          alt={t('phoneAlt')}
          width={1421}
          height={908}
          sizes="(max-width: 1199px) 86vw, 607px"
          className={cx(s.ca, s.pcPhone)}
          style={cbox({ x: 0, y: 0, w: 1421, h: 908 })}
        />
      </div>
    </article>
  )
}
