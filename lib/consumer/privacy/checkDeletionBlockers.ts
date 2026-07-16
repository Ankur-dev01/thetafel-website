import 'server-only'
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'

/**
 * GDPR erasure blocking checks (C8.2).
 *
 * Read-only pre-check run by the verify route before attempting
 * anonymisation, so the guest gets a specific, friendly reason. The
 * `anonymise_guest` Postgres function (migration 017) re-checks the same
 * conditions internally as a safety net against a race between this check
 * and the atomic anonymisation call — if something changed in that window,
 * the function aborts before any write and the caller falls back to a
 * generic blocked message.
 */

export type DeletionBlockReason = 'upcoming_booking' | 'active_order' | 'payment_in_flight'

export type DeletionBlockDetails = {
  restaurantName: string | null
  slotTime?: string
  orderRef?: string
}

export type CheckDeletionBlockersResult =
  | { ok: true }
  | { ok: false; reason: DeletionBlockReason; details: DeletionBlockDetails }

function restaurantDisplayName(r: {
  display_name?: string | null
  legal_name?: string | null
  name?: string | null
} | null | undefined): string | null {
  if (!r) return null
  return r.display_name?.trim() || r.legal_name?.trim() || r.name?.trim() || null
}

export async function checkDeletionBlockers(guestId: string): Promise<CheckDeletionBlockersResult> {
  const admin = await createSupabaseServerClientAdmin()

  const { data: upcomingBooking } = await admin
    .from('bookings')
    .select('slot_time, restaurants(display_name, legal_name, name)')
    .eq('guest_id', guestId)
    .in('status', ['pending', 'confirmed'])
    .gte('slot_time', new Date(new Date().toDateString()).toISOString())
    .order('slot_time', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (upcomingBooking) {
    const { restaurants, slot_time } = upcomingBooking as typeof upcomingBooking & {
      restaurants: { display_name: string | null; legal_name: string | null; name: string | null } | null
    }
    return {
      ok: false,
      reason: 'upcoming_booking',
      details: { restaurantName: restaurantDisplayName(restaurants), slotTime: slot_time },
    }
  }

  const { data: activeOrder } = await admin
    .from('orders')
    .select('order_ref, restaurants(display_name, legal_name, name)')
    .eq('guest_id', guestId)
    .in('status', ['pending', 'confirmed', 'preparing', 'ready', 'served'])
    .limit(1)
    .maybeSingle()

  if (activeOrder) {
    const { restaurants, order_ref } = activeOrder as typeof activeOrder & {
      restaurants: { display_name: string | null; legal_name: string | null; name: string | null } | null
    }
    return {
      ok: false,
      reason: 'active_order',
      details: { restaurantName: restaurantDisplayName(restaurants), orderRef: order_ref },
    }
  }

  const { data: bookingIdsRaw } = await admin.from('bookings').select('id').eq('guest_id', guestId)
  const { data: orderIdsRaw } = await admin.from('orders').select('id').eq('guest_id', guestId)
  const bookingIds = (bookingIdsRaw ?? []).map((b) => b.id as string)
  const orderIds = (orderIdsRaw ?? []).map((o) => o.id as string)

  if (bookingIds.length > 0 || orderIds.length > 0) {
    const filters: string[] = []
    if (bookingIds.length > 0) {
      const { data } = await admin
        .from('bookings')
        .select('deposit_intent_id, refund_intent_id')
        .eq('guest_id', guestId)
      for (const b of data ?? []) {
        if (b.deposit_intent_id) filters.push(b.deposit_intent_id as string)
        if (b.refund_intent_id) filters.push(b.refund_intent_id as string)
      }
    }
    if (orderIds.length > 0) {
      const { data } = await admin
        .from('orders')
        .select('payment_intent_id, refund_intent_id')
        .eq('guest_id', guestId)
      for (const o of data ?? []) {
        if (o.payment_intent_id) filters.push(o.payment_intent_id as string)
        if (o.refund_intent_id) filters.push(o.refund_intent_id as string)
      }
    }

    if (filters.length > 0) {
      const { data: pendingPayment } = await admin
        .from('payment_intents')
        .select('id')
        .in('id', filters)
        .eq('status', 'pending')
        .limit(1)
        .maybeSingle()

      if (pendingPayment) {
        return { ok: false, reason: 'payment_in_flight', details: { restaurantName: null } }
      }
    }
  }

  return { ok: true }
}
