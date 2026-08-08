import { adminClient, TEST_RESTAURANT_ID, TEST_RESTAURANT_SLUG } from './test-restaurant'

/**
 * Resets the test restaurant's opening hours to a known canonical pattern:
 * Mon-Sat 11:00–22:00, service_scope='all', tag_lunch/tag_dinner on, Sunday
 * closed (no row at all — closed days are represented by row absence, not
 * `is_active=false`). Also resets `hours_per_service_override` to false, so
 * every D5.1 spec starts from the unified-hours state regardless of what a
 * prior test left behind.
 *
 * This canonical seed matches what the D5.1 pre-investigation observed on
 * the test restaurant in production, minus Sunday, which is intentionally
 * closed here to give the spec a "closed day" case to assert on.
 *
 * Restaurant-id-scoped with a hard-coded allowlist, same shape as
 * resetTestRestaurantPauseState — this must never be callable against a real
 * restaurant's hours.
 */
export async function resetTestRestaurantHours(restaurantId: string = TEST_RESTAURANT_ID): Promise<void> {
  if (restaurantId !== TEST_RESTAURANT_ID) {
    throw new Error(
      `resetTestRestaurantHours refuses to touch restaurant ${restaurantId}. ` +
        `Only ${TEST_RESTAURANT_ID} (${TEST_RESTAURANT_SLUG}) is permitted.`,
    )
  }

  const supabase = adminClient()

  const { error: flagError } = await supabase
    .from('restaurants')
    .update({ hours_per_service_override: false })
    .eq('id', restaurantId)
  if (flagError) {
    throw new Error(`resetTestRestaurantHours failed (flag): ${flagError.message}`)
  }

  const { error: deleteError } = await supabase.from('availability').delete().eq('restaurant_id', restaurantId)
  if (deleteError) {
    throw new Error(`resetTestRestaurantHours failed (delete): ${deleteError.message}`)
  }

  const seedRows = [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
    restaurant_id: restaurantId,
    day_of_week: dayOfWeek,
    service_scope: 'all',
    open_time: '11:00',
    close_time: '22:00',
    closes_next_day: false,
    is_active: true,
    tag_brunch: false,
    tag_lunch: true,
    tag_dinner: true,
  }))

  const { error: insertError } = await supabase.from('availability').insert(seedRows)
  if (insertError) {
    throw new Error(`resetTestRestaurantHours failed (insert): ${insertError.message}`)
  }
}

/** Availability rows for the test restaurant, for direct DB assertions in specs. */
export async function getAvailabilityRows(restaurantId: string = TEST_RESTAURANT_ID) {
  if (restaurantId !== TEST_RESTAURANT_ID) {
    throw new Error(
      `getAvailabilityRows refuses to read restaurant ${restaurantId}. ` +
        `Only ${TEST_RESTAURANT_ID} (${TEST_RESTAURANT_SLUG}) is permitted.`,
    )
  }
  const supabase = adminClient()
  const { data, error } = await supabase
    .from('availability')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('service_scope', { ascending: true })
    .order('day_of_week', { ascending: true })
  if (error) {
    throw new Error(`getAvailabilityRows failed: ${error.message}`)
  }
  return data ?? []
}
