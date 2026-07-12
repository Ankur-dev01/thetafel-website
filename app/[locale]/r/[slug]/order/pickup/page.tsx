// app/[locale]/r/[slug]/order/pickup/page.tsx
//
// T3 pickup-time picker. Reached from the cart drawer's Continue button
// (C6.1). Two shapes depending on the restaurant's
// takeaway_scheduled_orders_allowed flag — see PickupTimePicker.tsx.
//
// Replaces the C6.1 "coming shortly" placeholder.

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { resolveRestaurantBySlug } from '@/lib/consumer/resolveRestaurant'
import { PickupTimePicker } from '@/components/consumer/takeaway/PickupTimePicker'
import { buildRestaurantMetadata } from '@/lib/consumer/metadata'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ locale: string; slug: string }>
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

export default async function TakeawayPickupPage({ params }: PageProps) {
  const { locale: rawLocale, slug } = await params
  const locale: 'nl' | 'en' = rawLocale === 'en' ? 'en' : 'nl'

  const restaurant = await resolveRestaurantBySlug(slug)
  if (!restaurant) notFound()

  return (
    <main style={{ backgroundColor: 'var(--cream, #fdfaf5)', minHeight: '100vh' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>
        <PickupTimePicker slug={slug} locale={locale} />
      </div>
    </main>
  )
}
