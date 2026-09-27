'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import type { ReactNode } from 'react'

/**
 * True when the current request is the booking journey (entry page or
 * confirmation screen) in iframe-embed mode (`?embed=1`).
 *
 * Scoped to these two booking routes specifically rather than to
 * `embed=1` alone — `ConsumerSlugLayout` wraps every route under
 * `/r/[slug]/...` (menu, order, qr, bookings/manage, these two), and
 * chrome must stay visible on all of those even if someone appends
 * `?embed=1` to a URL that isn't part of the booking journey. Prefer
 * explicit enumeration over a broad `/book` prefix match — any new
 * booking sub-route added later must be listed here explicitly.
 *
 * Exported so both `HideInEmbed` (chrome) and `CookieBanner` (consent,
 * rendered globally in the root layout, not scoped by route on its
 * own) can share one definition instead of two copies that could
 * drift apart.
 */
export function isEmbedBookingPath(
  pathname: string | null | undefined,
  searchParams: URLSearchParams | null | undefined
): boolean {
  const isBookingPath =
    pathname?.endsWith('/book') || pathname?.endsWith('/book/confirmed')
  return !!isBookingPath && searchParams?.get('embed') === '1'
}

export default function HideInEmbed({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  if (isEmbedBookingPath(pathname, searchParams)) return null
  return <>{children}</>
}
