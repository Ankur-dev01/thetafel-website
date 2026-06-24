import { notFound } from 'next/navigation'
import { resolveRestaurantBySlug } from '@/lib/consumer/resolveRestaurant'

/**
 * Placeholder for the booking flow (real implementation in C4).
 * Resolves the slug so an invalid one still 404s, and renders a tiny
 * "coming soon" notice in the layout chrome.
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
    <section
      style={{
        flex: '1 1 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '64px 24px',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-jost), sans-serif',
          fontSize: '14px',
          color: 'var(--stone, #7a7264)',
        }}
      >
        /r/{restaurant.slug}/book
      </p>
    </section>
  )
}
