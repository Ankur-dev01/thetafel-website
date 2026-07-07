import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { resolveTable } from '@/lib/qr/resolveTable'
import { payModesForRestaurant } from '@/lib/qr/payModesForRestaurant'
import { QrHeader } from '@/components/consumer/qr/QrHeader'
import { QrWelcome } from '@/components/consumer/qr/QrWelcome'
import { PayModeChooser } from '@/components/consumer/qr/PayModeChooser'
import { buildRestaurantMetadata } from '@/lib/consumer/metadata'

export const revalidate = 60

const TOKEN_RE = /^[A-Za-z0-9_-]{20,32}$/

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
 * Q2/Q3 checkout gateway — decides whether the guest needs to choose a pay
 * mode or can skip straight to the (single) available mode.
 */
export default async function QrCheckoutPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string; qrToken: string }>
}) {
  const { slug, qrToken } = await params

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
      const payModes = payModesForRestaurant(restaurant)

      if (payModes.soleMode) {
        redirect(`/r/${slug}/qr/${qrToken}/pay?mode=${payModes.soleMode}`)
      }

      if (payModes.modes.length === 0) {
        return (
          <>
            <QrHeader restaurant={restaurant} tableLabel={table.label} />
            <NotAvailableState slug={slug} />
          </>
        )
      }

      return (
        <>
          <QrHeader restaurant={restaurant} tableLabel={table.label} />
          <PayModeChooser
            slug={slug}
            qrToken={qrToken}
            restaurant={restaurant}
            tableLabel={table.label}
          />
        </>
      )
    }
  }
}

async function NotAvailableState({ slug }: { slug: string }) {
  const t = await getTranslations('consumer.qr.payModeChooser')
  const locale = await getLocale()
  return (
    <section
      style={{
        maxWidth: '560px',
        margin: '0 auto',
        padding: '48px 24px 80px',
        textAlign: 'center',
      }}
    >
      <h1
        style={{
          fontFamily: 'var(--font-raleway), serif',
          fontWeight: 900,
          fontSize: 'clamp(28px, 6vw, 36px)',
          lineHeight: 1.1,
          color: 'var(--night, #0f0d08)',
          margin: 0,
        }}
      >
        {t('notAvailableHeading')}
      </h1>
      <p
        style={{
          fontFamily: 'var(--font-jost), sans-serif',
          fontWeight: 400,
          fontSize: '16px',
          lineHeight: 1.55,
          color: 'var(--stone, #7a7264)',
          margin: '16px 0 0 0',
        }}
      >
        {t('notAvailableBody')}
      </p>
      <a
        href={locale === 'en' ? `/en/r/${slug}` : `/r/${slug}`}
        style={{
          display: 'inline-block',
          marginTop: '24px',
          fontFamily: 'var(--font-jost), sans-serif',
          fontWeight: 500,
          fontSize: '14px',
          color: 'var(--stone, #7a7264)',
        }}
      >
        {locale === 'en' ? '← Back' : '← Terug'}
      </a>
    </section>
  )
}
