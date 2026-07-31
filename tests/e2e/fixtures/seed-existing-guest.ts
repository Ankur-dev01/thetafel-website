import { randomBytes, createHash } from 'node:crypto'
import { generateBookingRef } from '@/lib/booking/bookingRef'
import { adminClient, TEST_RESTAURANT_TABLE_ID } from './test-restaurant'

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function amsterdamCivilDateToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date())
}

/**
 * Seeds a guest with `phoneE164` and N prior ATTENDED bookings at the test
 * restaurant, for the D2.4 walk-in phone auto-match test. Deliberately not
 * tagged with the `e2e-*@e2e.thetafel.invalid` email pattern `wipeTestRestaurant`
 * scans for (walk-in guests routinely have no email) — cleanup is manual via
 * `cleanupSeededExistingGuest`, called from the test's own `finally`.
 */
export async function seedExistingGuest(opts: {
  restaurantId: string
  fullName: string
  phoneE164: string
  priorVisitsDaysAgo: number[]
}): Promise<{ guestId: string; bookingIds: string[] }> {
  const supabase = adminClient()

  const { data: guest, error: guestError } = await supabase
    .from('guests')
    .insert({ full_name: opts.fullName, email: null, phone: opts.phoneE164, marketing_consent: false })
    .select('id')
    .single()
  if (guestError || !guest) throw new Error(`[seedExistingGuest] guest failed: ${guestError?.message}`)

  const today = amsterdamCivilDateToday()
  const [y, m, d] = today.split('-').map(Number)

  const bookingIds: string[] = []
  for (const daysAgo of opts.priorVisitsDaysAgo) {
    const slotUtc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
    slotUtc.setUTCDate(slotUtc.getUTCDate() - daysAgo)
    const token = randomBytes(32).toString('base64url')

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        restaurant_id: opts.restaurantId,
        guest_id: guest.id,
        booking_ref: generateBookingRef(),
        slot_time: slotUtc.toISOString(),
        party_size: 2,
        duration_minutes: 90,
        status: 'attended',
        source: 'online',
        magic_link_token_hash: hashToken(token),
        attended_at: slotUtc.toISOString(),
      })
      .select('id')
      .single()
    if (bookingError || !booking) {
      throw new Error(`[seedExistingGuest] booking failed: ${bookingError?.message}`)
    }
    bookingIds.push(booking.id)

    const { error: btError } = await supabase
      .from('booking_tables')
      .insert({ booking_id: booking.id, table_id: TEST_RESTAURANT_TABLE_ID })
    if (btError) throw new Error(`[seedExistingGuest] booking_tables failed: ${btError.message}`)
  }

  return { guestId: guest.id, bookingIds }
}

/** Deletes the seeded guest row (bookings/booking_tables are cleaned up by wipeTestRestaurant). */
export async function cleanupSeededExistingGuest(guestId: string): Promise<void> {
  const supabase = adminClient()
  await supabase.from('guests').delete().eq('id', guestId)
}
