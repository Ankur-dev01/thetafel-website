import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_PROD_URL
const SERVICE_ROLE = process.env.SUPABASE_PROD_SERVICE_ROLE_KEY

// NOTE: there is currently no separate dev/staging Supabase project — this
// is the same project the app talks to everywhere else (see
// lib/supabase/server.ts). Any write made here is a write to that project.
// Test isolation depends entirely on tagging + cleanup below, not on
// pointing at a sandboxed database.

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
 * Test guest email for a given run — the tag that ties everything created
 * by that run together. `guests`, `bookings`, and `orders` have no
 * metadata/JSONB column to stash a test_run_id in (see
 * TheTafel_Consumer_Schema_v1_0.sql — deferred in PHASE_3_DEFERRED.md),
 * so isolation goes through the guest email/phone pair instead.
 */
export function testGuestEmail(testRunId: string): string {
  return `e2e-${testRunId}@e2e.thetafel.invalid`
}

export const TEST_GUEST_PHONE = '+31600000000'

/**
 * Deletes everything created by a test run, cascading from the tagged
 * guest row: audit logs referencing its bookings/orders, then the
 * bookings/orders/booking_tables themselves, then the guest row.
 * Guests are anonymised-then-deleted here (test data, not a real guest —
 * safe to hard-delete, unlike the production GDPR erasure path which only
 * anonymises).
 */
export async function cleanupTestRun(testRunId: string): Promise<void> {
  const supabase = adminClient()
  const email = testGuestEmail(testRunId)

  const { data: guests } = await supabase.from('guests').select('id').eq('email', email)
  const guestIds = (guests ?? []).map((g) => g.id as string)
  if (guestIds.length === 0) return

  const { data: bookings } = await supabase.from('bookings').select('id').in('guest_id', guestIds)
  const { data: orders } = await supabase.from('orders').select('id').in('guest_id', guestIds)
  const bookingIds = (bookings ?? []).map((b) => b.id as string)
  const orderIds = (orders ?? []).map((o) => o.id as string)

  if (bookingIds.length > 0) {
    await supabase.from('consumer_audit_logs').delete().in('booking_id', bookingIds)
    await supabase.from('booking_tables').delete().in('booking_id', bookingIds)
    await supabase.from('bookings').delete().in('id', bookingIds)
  }
  if (orderIds.length > 0) {
    await supabase.from('consumer_audit_logs').delete().in('order_id', orderIds)
    await supabase.from('order_items').delete().in('order_id', orderIds)
    await supabase.from('orders').delete().in('id', orderIds)
  }

  await supabase.from('guests').delete().in('id', guestIds)
}
