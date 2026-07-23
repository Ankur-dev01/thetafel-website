// app/[locale]/r/[slug]/order/page.tsx
//
// T0 (landing) + T1 (menu browse) for takeaway.
// One URL. Guest scrolls: hero at top (reused <RestaurantHeader>), takeaway
// banner, menu below. T2 (cart) is the drawer that opens from the sticky
// footer. Continuing from the cart drawer takes the guest to /order/pickup
// (T3 placeholder in this unit, real page in C6.2).

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { resolveRestaurantBySlug } from '@/lib/consumer/resolveRestaurant'
import { computeTakeawayOpeningWindow } from '@/lib/takeaway/openingWindow'
import { fetchMenu } from '@/lib/menu/fetchMenu'
import { RestaurantHeader } from '@/components/consumer/RestaurantHeader'
import { TakeawayLanding } from '@/components/consumer/takeaway/TakeawayLanding'
import { MenuBrowser } from '@/components/consumer/menu/MenuBrowser'
import { PausedBanner } from '@/components/consumer/PausedBanner'
import { buildRestaurantMetadata } from '@/lib/consumer/metadata'

export const revalidate = 60

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

export default async function TakeawayLandingPage({ params }: PageProps) {
  const { locale: rawLocale, slug } = await params
  const locale: 'nl' | 'en' = rawLocale === 'en' ? 'en' : 'nl'

  const restaurant = await resolveRestaurantBySlug(slug)
  if (!restaurant) notFound()

  if (restaurant.paused_at !== null) {
    return (
      <main style={{ backgroundColor: 'var(--cream, #fdfaf5)', minHeight: '100vh' }}>
        <RestaurantHeader restaurant={restaurant} />
        <PausedBanner />
      </main>
    )
  }

  const window = await computeTakeawayOpeningWindow(restaurant.id)
  const menu = await fetchMenu(restaurant.id, 'takeaway', locale)

  const t = await getTranslations({ locale, namespace: 'consumer.takeaway.landing' })

  const canOrder = window.status === 'open_now'

  return (
    <main style={{ backgroundColor: 'var(--cream, #fdfaf5)', minHeight: '100vh' }}>
      <RestaurantHeader restaurant={restaurant} />
      <TakeawayLanding
        window={window}
        locale={locale}
        t={{
          eyebrow: t('eyebrow'),
          heading: t('heading'),
          earliestToday: (hhmm: string) => t('earliestToday', { time: hhmm }),
          closedToday: (day: string, hhmm: string) => t('closedToday', { day, time: hhmm }),
          unavailableServiceDisabled: t('unavailableServiceDisabled'),
          unavailableNotAccepting: t('unavailableNotAccepting'),
          unavailableNoUpcoming: t('unavailableNoUpcoming'),
        }}
      />

      {window.status !== 'unavailable' && menu.categories.length > 0 ? (
        <MenuBrowser
          restaurant={restaurant}
          menu={menu}
          itemNotesEnabled={restaurant.takeaway_item_notes_allowed}
          orderingDisabled={!canOrder}
        />
      ) : null}
    </main>
  )
}
