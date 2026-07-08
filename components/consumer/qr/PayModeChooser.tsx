'use client'

import { useState } from 'react'
import { useRouter } from '@/i18n/routing'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { resolveBrandTokens } from '@/lib/consumer/brandTokens'
import type { PublicRestaurant } from '@/lib/consumer/resolveRestaurant'
import type { PayMode } from '@/lib/qr/payModesForRestaurant'

type Props = {
  slug: string
  qrToken: string
  restaurant: PublicRestaurant
  tableLabel: string
}

export function PayModeChooser({ slug, qrToken, restaurant }: Props) {
  const t = useTranslations('consumer.qr.payModeChooser')
  const router = useRouter()
  const brand = resolveBrandTokens(restaurant)
  const [selected, setSelected] = useState<PayMode | null>(null)

  function handleContinue() {
    if (!selected) return
    router.push(`/r/${slug}/qr/${qrToken}/pay?mode=${selected}`)
  }

  return (
    <section
      style={{
        maxWidth: '560px',
        margin: '0 auto',
        padding: '32px 20px 100px',
      }}
    >
      <h1
        style={{
          fontFamily: brand.headlineFontFamily,
          fontWeight: 900,
          fontSize: 'clamp(28px, 6vw, 32px)',
          lineHeight: 1.1,
          color: 'var(--night, #0f0d08)',
          textAlign: 'center',
          margin: 0,
        }}
      >
        {t('heading')}
      </h1>
      <p
        style={{
          fontFamily: 'var(--font-jost), sans-serif',
          fontWeight: 400,
          fontSize: '15px',
          color: 'var(--stone, #7a7264)',
          textAlign: 'center',
          margin: '12px 0 0 0',
        }}
      >
        {t('subheading')}
      </p>

      <div
        className="pay-mode-cards"
        style={{
          marginTop: '32px',
          display: 'grid',
          gap: '16px',
        }}
      >
        <PayModeCard
          selected={selected === 'pay_now'}
          onClick={() => setSelected('pay_now')}
          eyebrow={t('payNow.eyebrow')}
          title={t('payNow.title')}
          description={t('payNow.description')}
          accentHex={brand.primaryHex}
        />
        <PayModeCard
          selected={selected === 'pay_at_table'}
          onClick={() => setSelected('pay_at_table')}
          title={t('payAtTable.title')}
          description={t('payAtTable.description')}
          accentHex={brand.primaryHex}
        />
      </div>

      <button
        type="button"
        className="tafel-tap"
        onClick={handleContinue}
        disabled={!selected}
        style={{
          width: '100%',
          marginTop: '24px',
          background: brand.primaryHex,
          color: '#fff',
          padding: '14px 20px',
          borderRadius: '999px',
          border: 'none',
          fontFamily: 'var(--font-jost), sans-serif',
          fontWeight: 600,
          fontSize: '15px',
        }}
      >
        {t('continue')}
      </button>

      <Link
        href={`/r/${slug}/qr/${qrToken}/menu`}
        style={{
          display: 'block',
          textAlign: 'center',
          marginTop: '20px',
          fontFamily: 'var(--font-jost), sans-serif',
          fontWeight: 500,
          fontSize: '14px',
          color: 'var(--stone, #7a7264)',
          textDecoration: 'none',
        }}
      >
        {t('backToBasket')}
      </Link>

      <style>{`
        @media (min-width: 640px) {
          .pay-mode-cards {
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>
    </section>
  )
}

function PayModeCard({
  selected,
  onClick,
  eyebrow,
  title,
  description,
  accentHex,
}: {
  selected: boolean
  onClick: () => void
  eyebrow?: string
  title: string
  description: string
  accentHex: string
}) {
  return (
    <button
      type="button"
      className="tafel-tap"
      onClick={onClick}
      style={{
        background: selected
          ? `color-mix(in srgb, ${accentHex} 8%, white)`
          : 'white',
        border: selected
          ? `2px solid ${accentHex}`
          : '2px solid rgba(30, 21, 8, 0.10)',
        padding: '24px 20px',
        borderRadius: '16px',
        textAlign: 'left',
        transition: 'background 0.16s ease, border-color 0.16s ease, transform 0.08s ease, opacity 0.12s ease',
      }}
    >
      {eyebrow ? (
        <p
          style={{
            fontFamily: 'var(--font-jost), sans-serif',
            fontWeight: 700,
            fontSize: '11px',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: accentHex,
            margin: 0,
          }}
        >
          {eyebrow}
        </p>
      ) : null}
      <p
        style={{
          fontFamily: 'var(--font-jost), sans-serif',
          fontWeight: 700,
          fontSize: '20px',
          color: 'var(--night, #0f0d08)',
          margin: eyebrow ? '6px 0 0 0' : 0,
        }}
      >
        {title}
      </p>
      <p
        style={{
          fontFamily: 'var(--font-jost), sans-serif',
          fontWeight: 400,
          fontSize: '14px',
          lineHeight: 1.5,
          color: 'var(--stone, #7a7264)',
          margin: '8px 0 0 0',
        }}
      >
        {description}
      </p>
    </button>
  )
}
