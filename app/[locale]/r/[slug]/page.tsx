import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { resolveRestaurantBySlug } from '@/lib/consumer/resolveRestaurant'

/**
 * Bare /r/[slug]/ landing page.
 *
 * Behaviour:
 *  - If the slug doesn't resolve to a live restaurant → branded 404.
 *  - If reservations are enabled → redirect to /r/[slug]/book.
 *  - Else if takeaway is enabled → redirect to /r/[slug]/order.
 *  - Else if QR ordering is enabled (but not reservations or takeaway) →
 *    render a small "scan the QR at your table" landing, because there's no
 *    self-serve entry point without scanning a physical table QR.
 *  - Else → 404. (A live restaurant must have at least one consumer service
 *    enabled; if none are, we don't expose the page.)
 *
 * The actual /book, /order, and /qr/[tableId] pages are built in later
 * prompts. For now /book is a placeholder page (file 7) and /order plus
 * /qr/[tableId] don't exist yet — that's fine, redirecting to a route that
 * doesn't exist will surface a normal Next.js 404, which is what we want
 * during this early phase. The QR-only fallback view below is fully built so
 * a QR-only live restaurant is never blank.
 */
export default async function RestaurantHomePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  const restaurant = await resolveRestaurantBySlug(slug)

  if (!restaurant) {
    notFound()
  }

  const localePrefix = locale === 'en' ? '/en' : ''
  const base = `${localePrefix}/r/${restaurant.slug}`

  if (restaurant.service_reservations_enabled) {
    redirect(`${base}/book`)
  }
  if (restaurant.service_takeaway_enabled) {
    redirect(`${base}/order`)
  }
  if (restaurant.service_qr_enabled) {
    // QR-only restaurant — render a small landing that explains the visitor
    // needs to scan a physical table QR to order. No /qr without a tableId.
    return <QrOnlyLanding name={displayName(restaurant)} />
  }

  // No consumer services enabled → treat as not found.
  notFound()
}

function displayName(restaurant: {
  display_name: string | null
  legal_name: string | null
  slug: string
}): string {
  return restaurant.display_name || restaurant.legal_name || restaurant.slug
}

async function QrOnlyLanding({ name }: { name: string }) {
  const t = await getTranslations('consumer.landing.qrOnly')

  return (
    <section
      style={{
        flex: '1 1 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '64px 24px',
        maxWidth: '560px',
        margin: '0 auto',
      }}
    >
      <h1
        style={{
          fontFamily: 'var(--font-raleway), serif',
          fontWeight: 900,
          fontSize: 'clamp(28px, 5vw, 40px)',
          lineHeight: 1.1,
          color: 'var(--night, #0f0d08)',
          margin: 0,
        }}
      >
        {name}
      </h1>
      <p
        style={{
          fontFamily: 'var(--font-jost), sans-serif',
          fontWeight: 400,
          fontSize: '16px',
          lineHeight: 1.55,
          color: 'var(--stone, #7a7264)',
          marginTop: '20px',
        }}
      >
        {t('body')}
      </p>
    </section>
  )
}
