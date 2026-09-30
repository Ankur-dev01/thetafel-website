import 'server-only'
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'
import { auditLog } from '@/lib/consumer/audit'

/**
 * Privacy events are logged once under PLATFORM_RESTAURANT_ID (the platform's
 * own record). Restaurants get their own view of the same events via one extra
 * row per affected restaurant, written here — same event_type, restaurant_id =
 * that restaurant, and only { requestReference?, reason?, fanout: true } as
 * data: no guest id, no IP, no user agent, nothing identifying.
 *
 * "Affected" = every restaurant the guest has a booking or order at. Compute
 * it BEFORE anonymisation runs, while the join is still intact.
 */
export async function getGuestRestaurantIds(guestId: string): Promise<string[]> {
  try {
    const admin = await createSupabaseServerClientAdmin()
    const [bookings, orders] = await Promise.all([
      admin.from('bookings').select('restaurant_id').eq('guest_id', guestId),
      admin.from('orders').select('restaurant_id').eq('guest_id', guestId),
    ])
    const ids = new Set<string>()
    for (const row of [...(bookings.data ?? []), ...(orders.data ?? [])]) {
      if (row.restaurant_id) ids.add(row.restaurant_id as string)
    }
    return [...ids]
  } catch (err) {
    console.error('[privacy] getGuestRestaurantIds failed', err)
    return []
  }
}

export async function fanOutPrivacyAudit(input: {
  eventType:
    | 'privacy.data_export_completed'
    | 'privacy.data_deletion_completed'
    | 'privacy.data_deletion_blocked'
  restaurantIds: string[]
  requestReference?: string
  reason?: string
}): Promise<void> {
  await Promise.all(
    input.restaurantIds.map((restaurantId) =>
      auditLog({
        restaurantId,
        eventType: input.eventType,
        eventData: {
          ...(input.requestReference ? { requestReference: input.requestReference } : {}),
          ...(input.reason ? { reason: input.reason } : {}),
          fanout: true,
        },
        actorType: 'guest',
      }).catch(() => {}),
    ),
  )
}
