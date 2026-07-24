import { randomUUID, randomBytes, createHash } from 'node:crypto'
import { generateBookingRef } from '@/lib/booking/bookingRef'
import { amsterdamWallClockToUtc } from '@/lib/booking/queries'
import { adminClient, TEST_RESTAURANT_TABLE_ID } from './test-restaurant'

type PriorBooking = {
  localTime: string
  daysAgo: number
  status: 'attended' | 'cancelled' | 'no_show'
}

type DeliveryEvent = {
  eventType: string
  minutesAgo: number
  eventData?: Record<string, unknown>
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function amsterdamCivilDateToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date())
}

function amsterdamCivilDateOffset(daysAgo: number): string {
  const [y, m, d] = amsterdamCivilDateToday().split('-').map(Number)
  const utc = new Date(Date.UTC(y, m - 1, d))
  utc.setUTCDate(utc.getUTCDate() - daysAgo)
  return utc.toISOString().slice(0, 10)
}

/** Seeds one booking + guest + optional history for tests/e2e/dashboard/booking-detail.spec.ts. */
export async function seedBookingDetail(opts: {
  restaurantId: string
  bookingLocalTime: string
  bookingStatus: 'pending' | 'confirmed' | 'attended' | 'cancelled' | 'no_show'
  partySize?: number
  depositAmountCents?: number
  depositIntentStatus?: 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded'
  priorBookings?: PriorBooking[]
  restaurantNote?: string
  deliveryEvents?: DeliveryEvent[]
}): Promise<{ bookingId: string; guestId: string; priorBookingIds: string[] }> {
  const supabase = adminClient()
  const today = amsterdamCivilDateToday()

  const uuid = randomUUID()
  const email = `e2e-${uuid}@thetafel.test`
  const { data: guest, error: guestError } = await supabase
    .from('guests')
    .insert({ full_name: 'E2E Detail Guest', email, phone: '+31600000005', marketing_consent: false })
    .select('id')
    .single()
  if (guestError || !guest) throw new Error(`[seedBookingDetail] guest failed: ${guestError?.message}`)

  const priorBookingIds: string[] = []
  for (const prior of opts.priorBookings ?? []) {
    const civilDate = amsterdamCivilDateOffset(prior.daysAgo)
    const slotUtc = amsterdamWallClockToUtc(civilDate, `${prior.localTime}:00`)
    const token = randomBytes(32).toString('base64url')
    const { data: priorBooking, error: priorError } = await supabase
      .from('bookings')
      .insert({
        restaurant_id: opts.restaurantId,
        guest_id: guest.id,
        booking_ref: generateBookingRef(),
        slot_time: slotUtc.toISOString(),
        party_size: 2,
        duration_minutes: 120,
        status: prior.status,
        source: 'online',
        magic_link_token_hash: hashToken(token),
        cancelled_at: prior.status === 'cancelled' ? new Date().toISOString() : null,
        cancelled_by: prior.status === 'cancelled' ? 'e2e-seed' : null,
        attended_at: prior.status === 'attended' ? slotUtc.toISOString() : null,
      })
      .select('id')
      .single()
    if (priorError || !priorBooking) {
      throw new Error(`[seedBookingDetail] prior booking failed: ${priorError?.message}`)
    }
    priorBookingIds.push(priorBooking.id)
  }

  let depositIntentId: string | null = null
  if (opts.depositAmountCents && opts.depositIntentStatus) {
    const { data: intent, error: intentError } = await supabase
      .from('payment_intents')
      .insert({
        restaurant_id: opts.restaurantId,
        purpose: 'deposit',
        status: opts.depositIntentStatus,
        amount_cents: opts.depositAmountCents,
      })
      .select('id')
      .single()
    if (intentError || !intent) {
      throw new Error(`[seedBookingDetail] payment_intent failed: ${intentError?.message}`)
    }
    depositIntentId = intent.id
  }

  const slotUtc = amsterdamWallClockToUtc(today, `${opts.bookingLocalTime}:00`)
  const bookingToken = randomBytes(32).toString('base64url')
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      restaurant_id: opts.restaurantId,
      guest_id: guest.id,
      booking_ref: generateBookingRef(),
      slot_time: slotUtc.toISOString(),
      party_size: opts.partySize ?? 2,
      duration_minutes: 120,
      status: opts.bookingStatus,
      source: 'online',
      deposit_amount_cents: opts.depositAmountCents ?? null,
      deposit_intent_id: depositIntentId,
      magic_link_token_hash: hashToken(bookingToken),
      cancelled_at: opts.bookingStatus === 'cancelled' ? new Date().toISOString() : null,
      cancelled_by: opts.bookingStatus === 'cancelled' ? 'e2e-seed' : null,
      attended_at: opts.bookingStatus === 'attended' ? slotUtc.toISOString() : null,
    })
    .select('id')
    .single()
  if (bookingError || !booking) {
    throw new Error(`[seedBookingDetail] booking failed: ${bookingError?.message}`)
  }

  const { error: btError } = await supabase
    .from('booking_tables')
    .insert([{ booking_id: booking.id, table_id: TEST_RESTAURANT_TABLE_ID }])
  if (btError) throw new Error(`[seedBookingDetail] booking_tables failed: ${btError.message}`)

  if (opts.restaurantNote) {
    // Requires an owner staff row — D0.1 backfills one per restaurant.
    const { data: ownerStaff } = await supabase
      .from('restaurant_staff')
      .select('id')
      .eq('restaurant_id', opts.restaurantId)
      .eq('role', 'owner')
      .maybeSingle()
    const { error: noteError } = await supabase.from('guest_notes').insert({
      restaurant_id: opts.restaurantId,
      guest_id: guest.id,
      note: opts.restaurantNote,
      updated_by: ownerStaff?.id ?? null,
    })
    if (noteError) throw new Error(`[seedBookingDetail] guest_notes failed: ${noteError.message}`)
  }

  for (const event of opts.deliveryEvents ?? []) {
    const { error: eventError } = await supabase.from('consumer_audit_logs').insert({
      restaurant_id: opts.restaurantId,
      event_type: event.eventType,
      event_data: event.eventData ?? {},
      actor_type: 'system',
      booking_id: booking.id,
      created_at: new Date(Date.now() - event.minutesAgo * 60_000).toISOString(),
    })
    if (eventError) throw new Error(`[seedBookingDetail] consumer_audit_logs failed: ${eventError.message}`)
  }

  return { bookingId: booking.id, guestId: guest.id, priorBookingIds }
}

/** Wipes guest_notes/consumer_audit_logs/dashboard_audit_logs left by this fixture, then the guest itself. */
export async function cleanupSeededBookingDetail(guestId: string): Promise<void> {
  const supabase = adminClient()
  await supabase.from('guest_notes').delete().eq('guest_id', guestId)
  await supabase.from('guests').delete().eq('id', guestId)
}
