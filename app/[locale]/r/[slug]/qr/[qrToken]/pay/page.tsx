import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { resolveTable } from '@/lib/qr/resolveTable'
import { QrHeader } from '@/components/consumer/qr/QrHeader'
import { QrWelcome } from '@/components/consumer/qr/QrWelcome'
import { OrderSubmit } from '@/components/consumer/qr/OrderSubmit'
import { buildRestaurantMetadata } from '@/lib/consumer/metadata'
import { resolveBrandTokens } from '@/lib/consumer/brandTokens'
import type { PayMode } from '@/lib/qr/payModesForRestaurant'

export const revalidate = 60

const TOKEN_RE = /^[A-Za-z0-9_-]{20,32}$/
const VALID_MODES: PayMode[] = ['pay_now', 'pay_at_table']

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string; qrToken: string }>
}): Promise<Metadata> {
  const { locale, slug, qrToken } = await params

  if (!TOKEN_RE.test(qrToken)) {
    return buildRestaurantMetadata({
      restaurant: null,
      locale: locale as 'nl' | 'en',
      slug,
      intent: 'qr_menu',
    })
  }

  const result = await resolveTable(slug, qrToken)

  return buildRestaurantMetadata({
    restaurant: result.status === 'ok' ? result.restaurant : null,
    locale: locale as 'nl' | 'en',
    slug,
    intent: 'qr_menu',
    tableLabel: result.status === 'ok' ? result.table.label : undefined,
  })
}

/**
 * Q4 order-submit page — renders the cart-backed OrderSubmit CTA for the
 * chosen pay mode. Reads the cart from the ambient CartProvider mounted in
 * qr/[qrToken]/layout.tsx, the same instance the guest built up on the menu
 * page — no remount, no localStorage round-trip needed to see it.
 */
export default async function QrPayPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string; qrToken: string }>
  searchParams: Promise<{ mode?: string; method?: string }>
}) {
  const { locale: rawLocale, slug, qrToken } = await params
  const locale: 'nl' | 'en' = rawLocale === 'en' ? 'en' : 'nl'
  const { mode: rawMode, method: rawMethod } = await searchParams

  if (!TOKEN_RE.test(qrToken)) notFound()

  const result = await resolveTable(slug, qrToken)

  switch (result.status) {
    case 'restaurant_not_found':
      notFound()
    case 'qr_disabled_restaurant':
      redirect(`/r/${slug}`)
    case 'qr_disabled_table':
    case 'unknown_table':
      return <QrWelcome mode="unknown_table" restaurant={null} table={null} />
    case 'ok': {
      const { restaurant, table } = result
      const mode: PayMode = VALID_MODES.includes(rawMode as PayMode)
        ? (rawMode as PayMode)
        : 'pay_now'
      const paymentMethod: 'ideal' | 'card' | undefined =
        rawMethod === 'card' ? 'card' : rawMethod === 'ideal' ? 'ideal' : undefined

      const brand = resolveBrandTokens(restaurant)
      const t = await getTranslations({ locale, namespace: 'consumer.qr.orderSubmit' })
      const tChooser = await getTranslations({ locale, namespace: 'consumer.qr.payModeChooser' })

      return (
        <>
          <QrHeader restaurant={restaurant} tableLabel={table.label} />
          <section style={{ maxWidth: '480px', margin: '0 auto', padding: '32px 20px 100px' }}>
            <h1
              style={{
                fontFamily: brand.headlineFontFamily,
                fontWeight: 900,
                fontSize: 'clamp(24px, 6vw, 28px)',
                lineHeight: 1.1,
                color: 'var(--night, #0f0d08)',
                margin: 0,
              }}
            >
              {mode === 'pay_now' ? tChooser('payNow.title') : tChooser('payAtTable.title')}
            </h1>
            <p
              style={{
                fontFamily: 'var(--font-jost), sans-serif',
                fontWeight: 400,
                fontSize: '15px',
                color: 'var(--stone, #7a7264)',
                margin: '10px 0 0 0',
              }}
            >
              {mode === 'pay_now' ? t('subPayNow') : t('subPayAtTable')}
            </p>

            <div style={{ marginTop: '28px' }}>
              <OrderSubmit
                locale={locale}
                slug={slug}
                tableId={table.id}
                payMode={mode}
                accentHex={brand.primaryHex}
                paymentMethod={paymentMethod}
                t={{
                  submitting: t('submitting'),
                  submit: mode === 'pay_now' ? t('submitPayNow') : t('submitPayAtTable'),
                  genericError: t('errors.generic'),
                  itemsInvalidBody: t('errors.itemsInvalidBody'),
                  rateLimited: t('errors.rateLimited'),
                  turnstileFailed: t('errors.turnstileFailed'),
                  noItems: t('errors.noItems'),
                  tabBusy: t('errors.tabBusy'),
                  payModeDisabled: t('errors.payModeDisabled'),
                  tableNotFound: t('errors.tableNotFound'),
                  mollieError: t('errors.mollieError'),
                }}
              />
            </div>

            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <Link
                href={`/r/${slug}/qr/${qrToken}/menu`}
                style={{
                  fontFamily: 'var(--font-jost), sans-serif',
                  fontWeight: 500,
                  fontSize: '14px',
                  color: 'var(--stone, #7a7264)',
                  textDecoration: 'none',
                }}
              >
                {t('backToMenu')}
              </Link>
            </div>
          </section>
        </>
      )
    }
  }
}
