import { randomUUID, randomBytes, createHash } from 'node:crypto'
import { generateBookingRef } from '@/lib/booking/bookingRef'
import { amsterdamWallClockToUtc } from '@/lib/booking/queries'
import { adminClient, TEST_RESTAURANT_TABLE_ID } from './test-restaurant'

/**
 * Seeds bookings/orders on the test restaurant for the D1.1 Vandaag tests.
 *
 * Guests are tagged `e2e-{uuid}@thetafel.test` — a DIFFERENT domain than
 * `testGuestEmail()`'s `@e2e.thetafel.invalid` pattern, so `wipeTestRestaurant()`'s
 * guest-anonymisation step (which only matches `e2e-%@e2e.thetafel.invalid`)
 * does not sweep them up. That's fine for bookings/orders — wipeTestRestaurant
 * deletes those by restaurant_id regardless of guest email — but the `guests`
 * rows themselves would otherwise accumulate. `cleanupSeededGuests()` below
 * hard-deletes them explicitly; call it after `wipeTestRestaurant()` in tests
 * that use this seed helper.
 */

type BookingStatus = 'pending' | 'confirmed' | 'attended'
type BookingSource = 'online' | 'walk_in'
type OrderType = 'qr' | 'takeaway'
type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'completed'
  | 'cancelled'
  | 'refunded'

export type SeedBookingInput = {
  localTime: string // 'HH:MM' Amsterdam-local
  partySize: number
  status: BookingStatus
  source?: BookingSource
}

export type SeedOrderInput = {
  orderType: OrderType
  status: OrderStatus
  totalCents: number
  paymentStatus?: string // default 'paid'
  pickupLocalTime?: string // 'HH:MM' for takeaway
  tableLabel?: string // for QR — resolves to the fixture table
  minutesAgoCreated?: number // default 0
}

function amsterdamCivilDateToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function generateOrderRefForTest(prefix: 'QR' | 'PU'): string {
  return `${prefix}-${randomBytes(4).toString('hex').toUpperCase()}`
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

async function createSeedGuest(): Promise<{ id: string; email: string }> {
  const supabase = adminClient()
  const uuid = randomUUID()
  const email = `e2e-${uuid}@thetafel.test`
  const { data, error } = await supabase
    .from('guests')
    .insert({
      full_name: 'E2E Seed Guest',
      email,
      phone: '+31600000001',
      marketing_consent: false,
    })
    .select('id, email')
    .single()
  if (error || !data) {
    throw new Error(`[seedTodayBookings] guest insert failed: ${error?.message}`)
  }
  return data
}

export async function seedTodayBookings(opts: {
  restaurantId: string
  bookings?: SeedBookingInput[]
  orders?: SeedOrderInput[]
}): Promise<{ bookingIds: string[]; orderIds: string[]; guestIds: string[] }> {
  const supabase = adminClient()
  const todayLocal = amsterdamCivilDateToday()

  const bookingIds: string[] = []
  const orderIds: string[] = []
  const guestIds: string[] = []

  for (const b of opts.bookings ?? []) {
    const guest = await createSeedGuest()
    guestIds.push(guest.id)

    const slotTime = amsterdamWallClockToUtc(todayLocal, `${b.localTime}:00`)
    const token = randomBytes(32).toString('base64url')

    const { data, error } = await supabase
      .from('bookings')
      .insert({
        restaurant_id: opts.restaurantId,
        guest_id: guest.id,
        booking_ref: generateBookingRef(),
        slot_time: slotTime.toISOString(),
        party_size: b.partySize,
        duration_minutes: 120,
        status: b.status,
        source: b.source ?? 'online',
        magic_link_token_hash: hashToken(token),
      })
      .select('id')
      .single()

    if (error || !data) {
      throw new Error(`[seedTodayBookings] booking insert failed: ${error?.message}`)
    }
    bookingIds.push(data.id)
  }

  for (const o of opts.orders ?? []) {
    const minutesAgo = o.minutesAgoCreated ?? 0
    const createdAt = new Date(Date.now() - minutesAgo * 60_000)
    const token = randomBytes(32).toString('base64url')

    const pickupTime = o.pickupLocalTime
      ? amsterdamWallClockToUtc(todayLocal, `${o.pickupLocalTime}:00`).toISOString()
      : null

    const { data, error } = await supabase
      .from('orders')
      .insert({
        restaurant_id: opts.restaurantId,
        order_ref: generateOrderRefForTest(o.orderType === 'qr' ? 'QR' : 'PU'),
        order_type: o.orderType,
        status: o.status,
        payment_status: o.paymentStatus ?? 'paid',
        subtotal_cents: o.totalCents,
        total_cents: o.totalCents,
        vat_cents: 0,
        pickup_time: pickupTime,
        table_id: o.orderType === 'qr' ? TEST_RESTAURANT_TABLE_ID : null,
        created_at: createdAt.toISOString(),
        magic_link_token_hash: hashToken(token),
      })
      .select('id')
      .single()

    if (error || !data) {
      throw new Error(`[seedTodayBookings] order insert failed: ${error?.message}`)
    }
    orderIds.push(data.id)
  }

  return { bookingIds, orderIds, guestIds }
}

/**
 * Hard-deletes seed guest rows by id. wipeTestRestaurant() already removes
 * the bookings/orders that reference them (scoped by restaurant_id); this
 * only needs to clean up the `guests` rows themselves, which live outside
 * that restaurant scope.
 */
export async function cleanupSeededGuests(guestIds: string[]): Promise<void> {
  if (guestIds.length === 0) return
  const supabase = adminClient()
  await supabase.from('guests').delete().in('id', guestIds)
}
