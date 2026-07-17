import type { ReactNode } from 'react'
import { resolveRestaurantBySlug } from '@/lib/consumer/resolveRestaurant'
import { CartProvider } from '@/lib/cart/CartContext'

/**
 * Wraps every page under /r/[slug]/order/... in a single CartProvider
 * instance so the takeaway cart survives navigation between the landing/menu
 * page, pickup picker, and details page instead of remounting on each one.
 * See the sibling qr/[qrToken]/layout.tsx for the same fix on the QR flow.
 */
export default async function OrderLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string }>
  children: ReactNode
}) {
  const { slug } = await params
  const restaurant = await resolveRestaurantBySlug(slug)

  if (!restaurant) {
    return <>{children}</>
  }

  return (
    <CartProvider slug={slug} context="takeaway" restaurantId={restaurant.id} tableId={null} qrToken={null}>
      {children}
    </CartProvider>
  )
}
