import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { resolveTable } from '@/lib/qr/resolveTable'
import { QrHeader } from '@/components/consumer/qr/QrHeader'
import { QrWelcome } from '@/components/consumer/qr/QrWelcome'
import { buildRestaurantMetadata } from '@/lib/consumer/metadata'
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
 * C5.5 placeholder — will be replaced by the real order-submit + payment flow.
 * For now it just confirms the chosen mode.
 */
export default async function QrPayPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string; qrToken: string }>
  searchParams: Promise<{ mode?: string }>
}) {
  const { slug, qrToken } = await params
  const { mode: rawMode } = await searchParams

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

      return (
        <>
          <QrHeader restaurant={restaurant} tableLabel={table.label} />
          <PaySoonContent slug={slug} qrToken={qrToken} mode={mode} />
        </>
      )
    }
  }
}

async function PaySoonContent({
  slug,
  qrToken,
  mode,
}: {
  slug: string
  qrToken: string
  mode: PayMode
}) {
  const t = await getTranslations('consumer.qr.paySoon')
  const tChooser = await getTranslations('consumer.qr.payModeChooser')

  return (
    <section
      style={{
        maxWidth: '480px',
        margin: '0 auto',
        padding: '48px 20px',
        textAlign: 'center',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-jost), sans-serif',
          fontWeight: 700,
          fontSize: '11px',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--amber, #d4820a)',
          margin: 0,
        }}
      >
        {t('eyebrow')}
      </p>
      <h1
        style={{
          fontFamily: 'var(--font-raleway), serif',
          fontWeight: 900,
          fontSize: 'clamp(26px, 6vw, 32px)',
          lineHeight: 1.1,
          color: 'var(--night, #0f0d08)',
          margin: '8px 0 0 0',
        }}
      >
        {t('heading')}
      </h1>
      <p
        style={{
          fontFamily: 'var(--font-jost), sans-serif',
          fontWeight: 400,
          fontSize: '15px',
          lineHeight: 1.55,
          color: 'var(--stone, #7a7264)',
          margin: '16px 0 0 0',
        }}
      >
        {t('body')}
      </p>
      <p
        style={{
          fontFamily: 'var(--font-jost), sans-serif',
          fontWeight: 500,
          fontSize: '13px',
          color: 'var(--stone, #7a7264)',
          margin: '16px 0 0 0',
        }}
      >
        {t('modeLabel')}:{' '}
        {mode === 'pay_now'
          ? tChooser('payNow.title')
          : tChooser('payAtTable.title')}
      </p>
      <Link
        href={`/r/${slug}/qr/${qrToken}/menu`}
        style={{
          display: 'inline-block',
          marginTop: '24px',
          fontFamily: 'var(--font-jost), sans-serif',
          fontWeight: 500,
          fontSize: '14px',
          color: 'var(--stone, #7a7264)',
          textDecoration: 'none',
        }}
      >
        {t('backToMenu')}
      </Link>
    </section>
  )
}
