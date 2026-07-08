'use client'

import { useLocale, useTranslations } from 'next-intl'
import type { ResolvedBrand } from '@/lib/consumer/brandTokens'
import { useCart } from '@/lib/cart/CartContext'
import { formatCents } from '@/lib/cart/pricing'

type Props = {
  brand: ResolvedBrand
}

export function CartStickyFooter({ brand }: Props) {
  const t = useTranslations('consumer.cart.stickyFooter')
  const locale = useLocale() as 'nl' | 'en'
  const { totals, openDrawer } = useCart()

  if (totals.itemCount === 0) return null

  const itemsLabel = t(totals.itemCount === 1 ? 'itemsOne' : 'itemsOther', {
    count: totals.itemCount,
  })
  const totalLabel = formatCents(totals.totalCents, locale)

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 40,
      }}
    >
      <div
        style={{
          maxWidth: '720px',
          margin: '0 auto',
          padding: '12px 16px',
        }}
      >
        <button
          type="button"
          className="tafel-tap"
          onClick={openDrawer}
          aria-label={`${t('cta')}, ${itemsLabel}, ${totalLabel}`}
          style={{
            width: '100%',
            background: brand.primaryHex,
            color: '#fff',
            padding: '14px 20px',
            borderRadius: '999px',
            border: 'none',
            fontFamily: 'var(--font-jost), sans-serif',
            fontWeight: 600,
            fontSize: '15px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 8px 24px rgba(30, 21, 8, 0.14)',
          }}
        >
          <span>
            {itemsLabel} · {totalLabel}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {t('cta')}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 6l6 6-6 6" />
            </svg>
          </span>
        </button>
      </div>
    </div>
  )
}
