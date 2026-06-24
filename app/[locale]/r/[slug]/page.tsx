import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { resolveRestaurantBySlug } from '@/lib/consumer/resolveRestaurant'
import type { PublicRestaurant } from '@/lib/consumer/resolveRestaurant'
import { RestaurantHeader } from '@/components/consumer/RestaurantHeader'

/**
 * Bare /r/[slug]/ landing page.
 *
 * - Unknown slug → branded 404.
 * - Reservations enabled → redirect to /book.
 * - Else takeaway enabled → redirect to /order.
 * - Else QR enabled → render the header + a "scan a table QR" landing.
 * - Else → 404.
 */
export default async function RestaurantHomePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  const restaurant = await resolveRestaurantBySlug(slug)

  if (!restaurant) notFound()

  const localePrefix = locale === 'en' ? '/en' : ''
  const base = `${localePrefix}/r/${restaurant.slug}`

  if (restaurant.service_reservations_enabled) {
    redirect(`${base}/book`)
  }
  if (restaurant.service_takeaway_enabled) {
    redirect(`${base}/order`)
  }
  if (restaurant.service_qr_enabled) {
    return <QrOnlyLanding restaurant={restaurant} />
  }

  notFound()
}

async function QrOnlyLanding({
  restaurant,
}: {
  restaurant: PublicRestaurant
}) {
  const t = await getTranslations('consumer.landing.qrOnly')

  return (
    <>
      <RestaurantHeader restaurant={restaurant} />
      <section
        style={{
          maxWidth: '560px',
          margin: '0 auto',
          padding: '48px 24px 80px',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-jost), sans-serif',
            fontWeight: 400,
            fontSize: '16px',
            lineHeight: 1.55,
            color: 'var(--stone, #7a7264)',
            margin: 0,
          }}
        >
          {t('body')}
        </p>
      </section>
    </>
  )
}
