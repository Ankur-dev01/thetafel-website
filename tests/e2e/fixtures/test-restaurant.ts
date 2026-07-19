import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_PROD_URL
const SERVICE_ROLE = process.env.SUPABASE_PROD_SERVICE_ROLE_KEY

// NOTE: there is currently no separate dev/staging Supabase project — this
// is the same project the app talks to everywhere else (see
// lib/supabase/server.ts). Isolation for e2e writes comes from scoping
// everything to the one dedicated restaurant below, not from a sandboxed
// database.

// The one and only restaurant that e2e tests are allowed to write to.
// Seeded once via a one-off script (see docs/PHASE_3_DEFERRED.md if it ever
// needs re-seeding) — not reproducible by running this file, since creating
// the owner requires the Supabase Auth admin API, not a plain insert.
//
// Slug is prefixed with `_` so no discovery/marketplace surface can ever
// route to it. status='live' + all three service flags enabled so the
// mutation doorman (assertConsumerWriteAllowed / loadBookingConfig) accepts
// writes against it.
export const TEST_RESTAURANT_ID = '47da4173-9b14-4079-a9b5-4efaf0096b40'
export const TEST_RESTAURANT_SLUG = '_e2e_test_restaurant'
export const TEST_RESTAURANT_ZONE_ID = '5e73e45f-70eb-4c99-9314-f4f42529d8b9'
export const TEST_RESTAURANT_TABLE_ID = '4d1bbbe1-a3a4-46ce-a0e9-2aed3556ad91'
export const TEST_RESTAURANT_TABLE_QR_TOKEN = 'V3aAsOHwDT7O6Gd5bzgpGQ'

let cachedClient: SupabaseClient | null = null

export function adminClient(): SupabaseClient {
  if (!cachedClient) {
    if (!SUPABASE_URL) {
      throw new Error('Playwright tests need NEXT_PUBLIC_SUPABASE_PROD_URL in env (.env.local).')
    }
    if (!SERVICE_ROLE) {
      throw new Error('Playwright tests need SUPABASE_PROD_SERVICE_ROLE_KEY in env (.env.local).')
    }
    cachedClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  }
  return cachedClient
}

/**
 * Test guest email — every guest a test creates against the test restaurant
 * should use this so `wipeTestRestaurant` (and anyone auditing the DB) can
 * tell test data from a real guest at a glance. `guests` has no restaurant_id
 * (a guest can book multiple restaurants) and no metadata column, so this is
 * the tag, not a JSONB field — see PHASE_3_DEFERRED.md item 5.
 */
export function testGuestEmail(testRunId: string): string {
  return `e2e-${testRunId}@e2e.thetafel.invalid`
}

export const TEST_GUEST_PHONE = '+31600000000'

/**
 * Deletes ALL bookings, orders, tabs, order-items, audit logs, magic links,
 * and payment intents scoped to the test restaurant, then anonymises any
 * `e2e-*@e2e.thetafel.invalid` guest rows. Safe to run whenever — the test
 * restaurant has no real guests, ever. Children deleted before parents to
 * satisfy FKs.
 */
export async function wipeTestRestaurant(): Promise<void> {
  const supabase = adminClient()
  const rId = TEST_RESTAURANT_ID

  const { data: orders } = await supabase.from('orders').select('id').eq('restaurant_id', rId)
  const orderIds = (orders ?? []).map((o) => o.id as string)
  if (orderIds.length > 0) {
    await supabase.from('order_items').delete().in('order_id', orderIds)
  }
  await supabase.from('orders').delete().eq('restaurant_id', rId)
  await supabase.from('tabs').delete().eq('restaurant_id', rId)

  const { data: bookings } = await supabase.from('bookings').select('id').eq('restaurant_id', rId)
  const bookingIds = (bookings ?? []).map((b) => b.id as string)
  if (bookingIds.length > 0) {
    await supabase.from('booking_tables').delete().in('booking_id', bookingIds)
  }
  await supabase.from('bookings').delete().eq('restaurant_id', rId)

  await supabase.from('payment_intents').delete().eq('restaurant_id', rId)
  await supabase.from('consumer_audit_logs').delete().eq('restaurant_id', rId)
  await supabase.from('magic_links').delete().eq('restaurant_id', rId)

  // Anonymise guests created by tests. Not restaurant-scoped at the DB level
  // (guests aren't FK'd to a single restaurant), but the email pattern only
  // ever gets used against the test restaurant, so this is safe.
  const { data: testGuests } = await supabase
    .from('guests')
    .select('id')
    .like('email_lower', 'e2e-%@e2e.thetafel.invalid')
  if (testGuests) {
    for (const g of testGuests) {
      await supabase.rpc('anonymise_guest', { p_guest_id: g.id })
    }
  }
}
