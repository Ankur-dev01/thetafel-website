import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { resolveTable } from '@/lib/qr/resolveTable'
import { RestaurantHeader } from '@/components/consumer/RestaurantHeader'
import { QrWelcome } from '@/components/consumer/qr/QrWelcome'
import { buildRestaurantMetadata } from '@/lib/consumer/metadata'
import { auditLog } from '@/lib/consumer/audit'

export const revalidate = 60

const TOKEN_RE = /^[A-Za-z0-9_-]{20,32}$/

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string; qrToken: string }>
}): Promise<Metadata> {
  const { locale, slug, qrToken } = await params

  if (!TOKEN_RE.test(qrToken)) {
    return buildRestaurantMetadata({
      restaurant: null,
      locale: locale as 'nl' | 'en',
      slug,
      intent: 'qr',
    })
  }

  const result = await resolveTable(slug, qrToken)

  return buildRestaurantMetadata({
    restaurant: result.status === 'ok' ? result.restaurant : null,
    locale: locale as 'nl' | 'en',
    slug,
    intent: 'qr',
    tableLabel: result.status === 'ok' ? result.table.label : undefined,
  })
}

/**
 * Canonical QR landing page (Q0). Reached via the /q/{token} short-URL
 * redirect, or directly if a guest bookmarks/shares the branded link.
 */
export default async function QrLandingPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string; qrToken: string }>
}) {
  const { slug, qrToken } = await params

  if (!TOKEN_RE.test(qrToken)) notFound()

  const result = await resolveTable(slug, qrToken)

  switch (result.status) {
    case 'restaurant_not_found':
      notFound()
    case 'qr_disabled_restaurant':
      redirect(`/r/${slug}`)
    case 'qr_disabled_table':
    case 'unknown_table':
      return <QrWelcome mode="unknown_table" restaurant={null} table={null} />
    case 'ok': {
      const { restaurant, table } = result

      try {
        await auditLog({
          restaurantId: restaurant.id,
          eventType: 'qr.session_started',
          eventData: { table_id: table.id, qr_token: table.qr_token },
          actorType: 'guest',
        })
      } catch (err) {
        console.error('[QrLandingPage] audit log failed', err)
      }

      return (
        <>
          <RestaurantHeader restaurant={restaurant} />
          <QrWelcome mode="welcome" restaurant={restaurant} table={table} />
        </>
      )
    }
  }
}
