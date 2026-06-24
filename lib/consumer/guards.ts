import 'server-only'
import { createSupabasePublicClient } from './supabasePublic'

/**
 * The "mutation doorman" — every consumer write endpoint calls this first.
 *
 * Loads the target restaurant by id and refuses the write if:
 *   - the restaurant doesn't exist
 *   - status is anything other than 'live'
 *   - the specific service the write needs is disabled
 *
 * Why we need this even with RLS, the slug resolver, and page-level redirects:
 *   - A guest could hold a stale form open across a service toggle-off.
 *   - API endpoints can be hit directly via curl / scripts.
 *   - The page-level checks never run for direct API calls.
 *
 * Returns a discriminated union — the API route can pattern-match on the
 * `ok` field and either continue with the resolved restaurant or shape a
 * proper response from the rejection reason.
 *
 * Modelled on Phase 1's `assertOnboardingMutationForUser` (restaurants/draft
 * route). Same shape, different concerns.
 */

export type ConsumerWriteAction =
  | 'booking.create'
  | 'booking.cancel'
  | 'booking.modify'
  | 'order.create'         // generic order; check specific type via order_type
  | 'order.cancel'
  | 'order.qr.create'
  | 'order.takeaway.create'
  | 'tab.create'
  | 'tab.settle'
  | 'magic_link.consume'   // doesn't need service check; only checks live status

export type ConsumerWriteRejectionReason =
  | 'restaurant_not_found'
  | 'restaurant_not_live'
  | 'service_reservations_disabled'
  | 'service_qr_disabled'
  | 'service_takeaway_disabled'

export type DoormanRestaurant = {
  id: string
  slug: string
  status: string
  service_reservations_enabled: boolean
  service_qr_enabled: boolean
  service_takeaway_enabled: boolean
}

export type ConsumerWriteCheck =
  | { ok: true; restaurant: DoormanRestaurant }
  | { ok: false; reason: ConsumerWriteRejectionReason; httpStatus: 404 | 409 }

/**
 * Check whether a consumer write is permitted for the given restaurant+action.
 *
 * The restaurant lookup runs through the cookies-free public client, so
 * authenticated owners get the same answer as anonymous guests — no
 * preview-via-owner-cookies escape hatch.
 */
export async function assertConsumerWriteAllowed(
  restaurantId: string,
  action: ConsumerWriteAction
): Promise<ConsumerWriteCheck> {
  if (!restaurantId || typeof restaurantId !== 'string') {
    return { ok: false, reason: 'restaurant_not_found', httpStatus: 404 }
  }

  const supabase = createSupabasePublicClient()
  const { data, error } = await supabase
    .from('restaurants')
    .select(
      'id, slug, status, service_reservations_enabled, service_qr_enabled, service_takeaway_enabled'
    )
    .eq('id', restaurantId)
    .maybeSingle()

  if (error) {
    console.error('[assertConsumerWriteAllowed] lookup failed', {
      restaurantId,
      action,
      error: error.message,
    })
    // Fail closed: any DB problem rejects the write rather than letting it
    // through. The client retries; we'd rather a guest see "try again" than
    // a half-committed booking.
    return { ok: false, reason: 'restaurant_not_found', httpStatus: 404 }
  }

  if (!data) {
    return { ok: false, reason: 'restaurant_not_found', httpStatus: 404 }
  }

  const r = data as unknown as DoormanRestaurant

  if (r.status !== 'live') {
    return { ok: false, reason: 'restaurant_not_live', httpStatus: 409 }
  }

  switch (action) {
    case 'booking.create':
    case 'booking.cancel':
    case 'booking.modify':
      if (!r.service_reservations_enabled) {
        return { ok: false, reason: 'service_reservations_disabled', httpStatus: 409 }
      }
      break

    case 'order.qr.create':
    case 'tab.create':
    case 'tab.settle':
      if (!r.service_qr_enabled) {
        return { ok: false, reason: 'service_qr_disabled', httpStatus: 409 }
      }
      break

    case 'order.takeaway.create':
      if (!r.service_takeaway_enabled) {
        return { ok: false, reason: 'service_takeaway_disabled', httpStatus: 409 }
      }
      break

    case 'order.create':
    case 'order.cancel':
      // Generic order action — caller should narrow to qr/takeaway when known.
      // Accept here; downstream validation handles type-specific service check.
      break

    case 'magic_link.consume':
      // Live check is sufficient. A guest can read/cancel their booking even
      // if reservations are disabled for new bookings — they already have one.
      break
  }

  return { ok: true, restaurant: r }
}

/**
 * Build a standardised rejection response payload from a doorman check.
 *
 * Callers do:
 *   const check = await assertConsumerWriteAllowed(id, 'booking.create')
 *   if (!check.ok) return NextResponse.json(rejectionPayload(check), { status: check.httpStatus })
 */
export function rejectionPayload(
  check: Extract<ConsumerWriteCheck, { ok: false }>
): { error: string; code: ConsumerWriteRejectionReason } {
  const messages: Record<ConsumerWriteRejectionReason, string> = {
    restaurant_not_found:
      'This restaurant does not exist or is not available.',
    restaurant_not_live:
      'This restaurant is not currently accepting requests.',
    service_reservations_disabled:
      'Reservations are temporarily unavailable.',
    service_qr_disabled:
      'QR ordering is temporarily unavailable.',
    service_takeaway_disabled:
      'Takeaway orders are temporarily unavailable.',
  }
  return {
    error: messages[check.reason],
    code: check.reason,
  }
}
