'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import type { ReactNode } from 'react'

/**
 * Hides its children when the current request is the booking page in
 * iframe-embed mode (`?embed=1`).
 *
 * Scoped to the booking entry page specifically (`.../r/[slug]/book`,
 * either locale) rather than to `embed=1` alone — `ConsumerSlugLayout`
 * wraps every route under `/r/[slug]/...` (menu, order, qr, bookings/manage,
 * this one), and chrome must stay visible on all of those even if someone
 * appends `?embed=1` to a URL that isn't the booking page. `endsWith('/book')`
 * deliberately excludes sibling routes like `.../book/confirmed`.
 */
export default function HideInEmbed({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isBookingEmbed = pathname?.endsWith('/book') && searchParams?.get('embed') === '1'
  if (isBookingEmbed) return null
  return <>{children}</>
}
