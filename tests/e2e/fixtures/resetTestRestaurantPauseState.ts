import { adminClient, TEST_RESTAURANT_ID, TEST_RESTAURANT_SLUG } from './test-restaurant'

/**
 * Clears every pause-related column on the test restaurant.
 *
 * `pause.spec.ts` pauses `_e2e_test_restaurant` from five different tests,
 * four of which (D4.5 preflight) cleaned up as a trailing statement rather
 * than in a `finally` — any assertion failure between the pause write and
 * that statement left the restaurant paused for every test that ran after,
 * including on a later day. Consumer specs then failed on missing UI
 * elements with no mention of "paused" anywhere in the output, which is
 * what made this expensive to diagnose each time it happened.
 *
 * The real column set is `paused_at`, `paused_by`, `pause_reason`, and
 * `grace_period_started_at` — there is no `pause_scope` or similar; verified
 * directly against the live schema, not assumed from a stale draft.
 *
 * Restaurant-id-scoped with a hard-coded allowlist: called with anything
 * other than the test restaurant, this throws instead of writing. Two other
 * *_enabled restaurants (OTS, and whichever draft is mid-onboarding) share
 * this table, so an accidental cross-restaurant write here would be a real
 * incident, not a test flake.
 *
 * Idempotent — safe to call on an already-unpaused restaurant, and safe to
 * call more than once.
 */
export async function resetTestRestaurantPauseState(restaurantId: string = TEST_RESTAURANT_ID): Promise<void> {
  if (restaurantId !== TEST_RESTAURANT_ID) {
    throw new Error(
      `resetTestRestaurantPauseState refuses to touch restaurant ${restaurantId}. ` +
        `Only ${TEST_RESTAURANT_ID} (${TEST_RESTAURANT_SLUG}) is permitted.`,
    )
  }

  const supabase = adminClient()
  const { error } = await supabase
    .from('restaurants')
    .update({
      paused_at: null,
      paused_by: null,
      pause_reason: null,
      grace_period_started_at: null,
    })
    .eq('id', restaurantId)

  if (error) {
    throw new Error(`resetTestRestaurantPauseState failed: ${error.message}`)
  }
}
