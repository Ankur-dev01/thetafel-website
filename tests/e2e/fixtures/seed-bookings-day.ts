import { randomUUID, randomBytes, createHash } from 'node:crypto'
import { generateBookingRef } from '@/lib/booking/bookingRef'
import { amsterdamWallClockToUtc } from '@/lib/booking/queries'
import { adminClient, TEST_RESTAURANT_TABLE_ID } from './test-restaurant'

type SeedBookingInput = {
  localTime: string
  partySize: number
  status: 'pending' | 'confirmed' | 'attended' | 'cancelled' | 'no_show'
  source?: 'online' | 'walk_in'
  depositAmountCents?: number
  depositState?: 'paid' | 'pending' | 'failed'
  zoneId?: string
  tableIds?: string[]
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Seeds a day-worth of bookings for tests/e2e/dashboard/bookings-list.spec.ts. */
export async function seedBookingsDay(opts: {
  restaurantId: string
  civilDate: string
  bookings: SeedBookingInput[]
}): Promise<{ bookingIds: string[]; guestIds: string[]; paymentIntentIds: string[] }> {
  const supabase = adminClient()
  const bookingIds: string[] = []
  const guestIds: string[] = []
  const paymentIntentIds: string[] = []

  for (const b of opts.bookings) {
    const uuid = randomUUID()
    const email = `e2e-${uuid}@thetafel.test`

    const { data: guest, error: guestError } = await supabase
      .from('guests')
      .insert({
        full_name: 'E2E Bookings Guest',
        email,
        phone: '+31600000004',
        marketing_consent: false,
      })
      .select('id')
      .single()
    if (guestError || !guest) throw new Error(`[seedBookingsDay] guest failed: ${guestError?.message}`)
    guestIds.push(guest.id)

    let depositIntentId: string | null = null
    if (b.depositAmountCents && b.depositState) {
      const status = b.depositState === 'paid' ? 'paid' : b.depositState === 'failed' ? 'failed' : 'pending'
      const { data: intent, error: intentError } = await supabase
        .from('payment_intents')
        .insert({
          restaurant_id: opts.restaurantId,
          purpose: 'deposit',
          status,
          amount_cents: b.depositAmountCents,
        })
        .select('id')
        .single()
      if (intentError || !intent) {
        throw new Error(`[seedBookingsDay] payment_intent failed: ${intentError?.message}`)
      }
      depositIntentId = intent.id
      paymentIntentIds.push(intent.id)
    }

    const slotUtc = amsterdamWallClockToUtc(opts.civilDate, `${b.localTime}:00`)
    const token = randomBytes(32).toString('base64url')

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        restaurant_id: opts.restaurantId,
        guest_id: guest.id,
        booking_ref: generateBookingRef(),
        slot_time: slotUtc.toISOString(),
        party_size: b.partySize,
        duration_minutes: 120,
        status: b.status,
        source: b.source ?? 'online',
        zone_id: b.zoneId ?? null,
        deposit_amount_cents: b.depositAmountCents ?? null,
        deposit_intent_id: depositIntentId,
        magic_link_token_hash: hashToken(token),
        // bookings_cancelled_consistent requires both fields set together.
        cancelled_at: b.status === 'cancelled' ? new Date().toISOString() : null,
        cancelled_by: b.status === 'cancelled' ? 'e2e-seed' : null,
        attended_at: b.status === 'attended' ? slotUtc.toISOString() : null,
      })
      .select('id')
      .single()
    if (bookingError || !booking) {
      throw new Error(`[seedBookingsDay] booking failed: ${bookingError?.message}`)
    }
    bookingIds.push(booking.id)

    const tableIds = b.tableIds ?? [TEST_RESTAURANT_TABLE_ID]
    if (tableIds.length > 0) {
      const { error: btError } = await supabase
        .from('booking_tables')
        .insert(tableIds.map((tableId) => ({ booking_id: booking.id, table_id: tableId })))
      if (btError) throw new Error(`[seedBookingsDay] booking_tables failed: ${btError.message}`)
    }
  }

  return { bookingIds, guestIds, paymentIntentIds }
}

/** Hard-deletes seed guest rows by id — mirrors D1.1's cleanupSeededGuests. */
export async function cleanupSeededGuests(guestIds: string[]): Promise<void> {
  if (guestIds.length === 0) return
  const supabase = adminClient()
  await supabase.from('guests').delete().in('id', guestIds)
}
