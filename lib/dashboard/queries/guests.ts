import 'server-only'

import { createSupabaseServerClient } from '@/lib/supabase/server'

export type ExistingGuestMatch = {
  guest: { id: string; full_name: string; phone: string | null; email: string | null }
  visitCount: number
}

/**
 * Restaurant-scoped guest lookup for walk-in phone auto-match (D2.4).
 *
 * Returns the matching guest ONLY if they have at least one prior booking
 * (any status) at THIS restaurant — joining through `bookings` is what keeps
 * this restaurant-scoped; a guest known at another restaurant must never
 * surface here (D2.2's privacy rule). Session client throughout — RLS on
 * `bookings` enforces the same restaurant scope as a second layer, not the
 * only one.
 *
 * If two guests somehow share a phone number at the same restaurant, the one
 * with more visits wins. Never throws — a lookup failure just means "no
 * match", so the walk-in falls through to creating a fresh guest.
 */
export async function findExistingGuestByPhoneAtRestaurant(
  restaurantId: string,
  phoneE164: string
): Promise<ExistingGuestMatch | null> {
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from('bookings')
    .select('guest_id, guest:guests!inner(id, full_name, phone, email, anonymised_at)')
    .eq('restaurant_id', restaurantId)
    .eq('guest.phone', phoneE164)
    .is('guest.anonymised_at', null)

  if (error) {
    console.error('[guests] findExistingGuestByPhoneAtRestaurant failed', { code: error.code })
    return null
  }

  type Row = {
    guest_id: string
    guest: { id: string; full_name: string; phone: string | null; email: string | null } | null
  }
  const rows = (data ?? []) as unknown as Row[]

  const visitCountByGuestId = new Map<string, number>()
  const guestById = new Map<string, Row['guest']>()
  for (const row of rows) {
    if (!row.guest) continue
    visitCountByGuestId.set(row.guest_id, (visitCountByGuestId.get(row.guest_id) ?? 0) + 1)
    guestById.set(row.guest_id, row.guest)
  }

  if (visitCountByGuestId.size === 0) return null

  let bestGuestId: string | null = null
  let bestCount = -1
  for (const [guestId, count] of visitCountByGuestId) {
    if (count > bestCount) {
      bestCount = count
      bestGuestId = guestId
    }
  }
  if (!bestGuestId) return null

  const guest = guestById.get(bestGuestId)
  if (!guest) return null

  return { guest, visitCount: bestCount }
}
