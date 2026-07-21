import { randomUUID, randomBytes, createHash } from 'node:crypto'
import { generateBookingRef } from '@/lib/booking/bookingRef'
import { adminClient, TEST_RESTAURANT_ID, TEST_RESTAURANT_TABLE_ID } from './test-restaurant'

/**
 * Per-alert seed helpers for tests/e2e/dashboard/alerts.spec.ts. Each returns
 * the id(s) it created (or, for the Mollie/pause cases, the prior restaurant
 * field values) so the test can clean up explicitly in its `finally` block.
 * `wipeTestRestaurant()` handles bookings/orders/tabs/payment_intents by
 * restaurant_id; these helpers only need to cover what that wipe misses
 * (consumer_audit_logs is already wiped by it too, and restaurants column
 * values need restoring, not deleting).
 */

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function randomOrderRef(prefix: 'QR' | 'PU'): string {
  return `${prefix}-${randomBytes(4).toString('hex').toUpperCase()}`
}

export async function seedPaymentFailedToday(): Promise<{ id: string }> {
  const supabase = adminClient()
  const { data, error } = await supabase
    .from('payment_intents')
    .insert({
      restaurant_id: TEST_RESTAURANT_ID,
      purpose: 'qr_order',
      status: 'failed',
      amount_cents: 1500,
      created_at: new Date(Date.now() - 30 * 60_000).toISOString(),
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`[seedPaymentFailedToday] failed: ${error?.message}`)
  return data
}

export async function seedOrderReadyStale(): Promise<{ id: string }> {
  const supabase = adminClient()
  const token = randomBytes(32).toString('base64url')
  const readyAt = new Date(Date.now() - 15 * 60_000).toISOString()
  const { data, error } = await supabase
    .from('orders')
    .insert({
      restaurant_id: TEST_RESTAURANT_ID,
      order_ref: randomOrderRef('PU'),
      order_type: 'takeaway',
      status: 'ready',
      payment_status: 'paid',
      subtotal_cents: 1800,
      total_cents: 1800,
      vat_cents: 0,
      pickup_time: readyAt,
      ready_notified_at: readyAt,
      updated_at: readyAt,
      magic_link_token_hash: hashToken(token),
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`[seedOrderReadyStale] failed: ${error?.message}`)
  return data
}

export async function seedTabOpenLong(): Promise<{ id: string }> {
  const supabase = adminClient()
  const { data, error } = await supabase
    .from('tabs')
    .insert({
      restaurant_id: TEST_RESTAURANT_ID,
      table_id: TEST_RESTAURANT_TABLE_ID,
      status: 'open',
      opened_at: new Date(Date.now() - 5 * 3600_000).toISOString(),
      total_cents: 4200,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`[seedTabOpenLong] failed: ${error?.message}`)
  return data
}

export async function seedBookingDepositPending(): Promise<{ bookingId: string; guestId: string }> {
  const supabase = adminClient()
  const uuid = randomUUID()
  const email = `e2e-${uuid}@thetafel.test`

  const { data: guest, error: guestError } = await supabase
    .from('guests')
    .insert({
      full_name: 'E2E Alert Guest',
      email,
      phone: '+31600000002',
      marketing_consent: false,
    })
    .select('id')
    .single()
  if (guestError || !guest) throw new Error(`[seedBookingDepositPending] guest failed: ${guestError?.message}`)

  const tomorrow = new Date(Date.now() + 24 * 3600_000).toISOString()
  const token = randomBytes(32).toString('base64url')

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      restaurant_id: TEST_RESTAURANT_ID,
      guest_id: guest.id,
      booking_ref: generateBookingRef(),
      slot_time: tomorrow,
      party_size: 2,
      duration_minutes: 120,
      status: 'confirmed',
      deposit_amount_cents: 2000,
      magic_link_token_hash: hashToken(token),
    })
    .select('id')
    .single()
  if (bookingError || !booking) {
    throw new Error(`[seedBookingDepositPending] booking failed: ${bookingError?.message}`)
  }

  return { bookingId: booking.id, guestId: guest.id }
}

export async function cleanupSeededGuest(guestId: string): Promise<void> {
  const supabase = adminClient()
  await supabase.from('guests').delete().eq('id', guestId)
}

export async function seedNotificationFailedToday(): Promise<{ id: string }> {
  const supabase = adminClient()
  const { data, error } = await supabase
    .from('consumer_audit_logs')
    .insert({
      restaurant_id: TEST_RESTAURANT_ID,
      event_type: 'email.send_failed',
      event_data: {},
      actor_type: 'system',
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`[seedNotificationFailedToday] failed: ${error?.message}`)
  return data
}

type RestaurantMollieSnapshot = {
  mollie_status: string
  mollie_access_token: string | null
  mollie_token_expires_at: string | null
  paused_at: string | null
  pause_reason: string | null
}

/** Snapshot the test restaurant's Mollie/pause columns before mutating them. */
export async function snapshotRestaurantMollieState(): Promise<RestaurantMollieSnapshot> {
  const supabase = adminClient()
  const { data, error } = await supabase
    .from('restaurants')
    .select('mollie_status, mollie_access_token, mollie_token_expires_at, paused_at, pause_reason')
    .eq('id', TEST_RESTAURANT_ID)
    .single()
  if (error || !data) throw new Error(`[snapshotRestaurantMollieState] failed: ${error?.message}`)
  return data as RestaurantMollieSnapshot
}

export async function setRestaurantMollieBroken(): Promise<void> {
  const supabase = adminClient()
  const { error } = await supabase
    .from('restaurants')
    .update({ mollie_status: 'needs_action' })
    .eq('id', TEST_RESTAURANT_ID)
  if (error) throw new Error(`[setRestaurantMollieBroken] failed: ${error.message}`)
}

export async function setRestaurantPausedBillingSuspended(): Promise<void> {
  const supabase = adminClient()
  const { error } = await supabase
    .from('restaurants')
    .update({ paused_at: new Date().toISOString(), pause_reason: 'billing_suspended' })
    .eq('id', TEST_RESTAURANT_ID)
  if (error) throw new Error(`[setRestaurantPausedBillingSuspended] failed: ${error.message}`)
}

export async function restoreRestaurantMollieState(snapshot: RestaurantMollieSnapshot): Promise<void> {
  const supabase = adminClient()
  const { error } = await supabase.from('restaurants').update(snapshot).eq('id', TEST_RESTAURANT_ID)
  if (error) throw new Error(`[restoreRestaurantMollieState] failed: ${error.message}`)
}
