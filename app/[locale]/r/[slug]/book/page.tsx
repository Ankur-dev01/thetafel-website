import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { resolveRestaurantBySlug } from '@/lib/consumer/resolveRestaurant'
import { RestaurantHeader } from '@/components/consumer/RestaurantHeader'
import { buildRestaurantMetadata } from '@/lib/consumer/metadata'

export const revalidate = 60

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = await params
  const restaurant = await resolveRestaurantBySlug(slug)
  return buildRestaurantMetadata({
    restaurant,
    locale: locale as 'nl' | 'en',
    slug,
    intent: 'book',
  })
}

/**
 * Placeholder for the booking flow (real implementation in C4).
 */
export default async function BookingPlaceholderPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { slug } = await params
  const restaurant = await resolveRestaurantBySlug(slug)
  if (!restaurant) notFound()

  return (
    <>
      <RestaurantHeader restaurant={restaurant} />
      <section
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '40px 20px 80px',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-jost), sans-serif',
            fontSize: '14px',
            color: 'var(--stone, #7a7264)',
          }}
        >
          /r/{restaurant.slug}/book — booking form arrives in C4.
        </p>
      </section>
    </>
  )
}
