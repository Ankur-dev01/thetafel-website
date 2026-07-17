// app/[locale]/r/[slug]/order/details/page.tsx
//
// T4 guest-details form + T5 Mollie kickoff (C6.3). Replaces the C6.2
// "coming shortly" placeholder. Reads ?pickup= from the picker (C6.2),
// and renders the details form + Turnstile + submit. Cart comes from the
// ambient CartProvider mounted in order/layout.tsx — the same instance the
// guest built up on the landing/menu page.

import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { resolveRestaurantBySlug } from '@/lib/consumer/resolveRestaurant'
import { DetailsAndPay } from '@/components/consumer/takeaway/DetailsAndPay'
import { buildRestaurantMetadata } from '@/lib/consumer/metadata'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ locale: string; slug: string }>
  searchParams: Promise<{ pickup?: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params
  const restaurant = await resolveRestaurantBySlug(slug)
  return buildRestaurantMetadata({
    restaurant,
    locale: locale as 'nl' | 'en',
    slug,
    intent: 'order',
  })
}

export default async function TakeawayDetailsPage({ params, searchParams }: PageProps) {
  const { locale: rawLocale, slug } = await params
  const { pickup } = await searchParams
  const locale: 'nl' | 'en' = rawLocale === 'en' ? 'en' : 'nl'

  if (!pickup || Number.isNaN(new Date(pickup).getTime())) {
    redirect(`/r/${slug}/order/pickup`)
  }

  const restaurant = await resolveRestaurantBySlug(slug)
  if (!restaurant) notFound()

  const restaurantName = restaurant.display_name ?? restaurant.legal_name ?? 'Restaurant'
  const t = await getTranslations({ locale, namespace: 'consumer.takeaway.details' })

  return (
    <main style={{ backgroundColor: 'var(--cream, #fdfaf5)', minHeight: '100vh' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '32px 20px 48px' }}>
        <h1
          style={{
            fontFamily: 'var(--font-raleway), serif',
            fontWeight: 900,
            fontSize: 'clamp(26px, 5vw, 32px)',
            color: 'var(--night, #0f0d08)',
            margin: '0 0 8px',
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
            margin: '0 0 24px',
          }}
        >
          {t('sub')}
        </p>
        <DetailsAndPay
          slug={slug}
          locale={locale}
          pickupInstant={pickup}
          restaurantName={restaurantName}
        />
      </div>
    </main>
  )
}
