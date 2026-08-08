import { adminClient, TEST_RESTAURANT_ID, TEST_RESTAURANT_SLUG } from './test-restaurant'

/**
 * Resets the test restaurant's 6 takeaway-ordering columns to a known
 * canonical pattern (prep 20 min, no minimum order, 15-min slots, accepting
 * orders, item notes on, scheduled orders off).
 *
 * `takeaway_scheduled_orders_allowed` is pinned to `false` — not a fresh
 * "canonical" choice — `tests/e2e/takeaway/pay-kickoff.spec.ts` hardcodes an
 * ASAP-only pickup UI assertion (single confirm button, no slot grid) that
 * only holds when this is off for the test restaurant. Grepped before
 * picking values, per the D5.2 T1-seats / D5.3 lesson.
 *
 * `service_takeaway_enabled` is NOT touched here — it's out of scope for
 * D5.4 (a bigger services-enable unit) and is already `true` on the test
 * restaurant, which is the state every spec in this file needs by default.
 * The one test that needs it `false` (informational-card state) flips it
 * directly and restores in `finally`.
 *
 * Restaurant-id-scoped with a hard-coded allowlist, same shape as
 * resetTestRestaurantHours / resetTestRestaurantFloor / resetTestRestaurantBookingRules.
 */
export async function resetTestRestaurantOrdering(restaurantId: string = TEST_RESTAURANT_ID): Promise<void> {
  if (restaurantId !== TEST_RESTAURANT_ID) {
    throw new Error(
      `resetTestRestaurantOrdering refuses to touch restaurant ${restaurantId}. ` +
        `Only ${TEST_RESTAURANT_ID} (${TEST_RESTAURANT_SLUG}) is permitted.`,
    )
  }

  const supabase = adminClient()
  const { error } = await supabase
    .from('restaurants')
    .update({
      takeaway_prep_time_minutes: 20,
      takeaway_min_order_cents: 0,
      takeaway_slot_interval_minutes: 15,
      takeaway_accepting_orders: true,
      takeaway_item_notes_allowed: true,
      takeaway_scheduled_orders_allowed: false,
    })
    .eq('id', restaurantId)

  if (error) {
    throw new Error(`resetTestRestaurantOrdering failed: ${error.message}`)
  }
}

/** Takeaway-ordering columns for the test restaurant, for direct DB assertions in specs. */
export async function getOrderingConfig(restaurantId: string = TEST_RESTAURANT_ID) {
  if (restaurantId !== TEST_RESTAURANT_ID) {
    throw new Error(
      `getOrderingConfig refuses to read restaurant ${restaurantId}. ` +
        `Only ${TEST_RESTAURANT_ID} (${TEST_RESTAURANT_SLUG}) is permitted.`,
    )
  }
  const supabase = adminClient()
  const { data, error } = await supabase
    .from('restaurants')
    .select(
      'takeaway_prep_time_minutes, takeaway_min_order_cents, takeaway_slot_interval_minutes, takeaway_accepting_orders, takeaway_item_notes_allowed, takeaway_scheduled_orders_allowed, service_takeaway_enabled',
    )
    .eq('id', restaurantId)
    .single()
  if (error) {
    throw new Error(`getOrderingConfig failed: ${error.message}`)
  }
  return data
}
