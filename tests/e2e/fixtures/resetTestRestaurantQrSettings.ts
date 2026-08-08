import { adminClient, TEST_RESTAURANT_ID, TEST_RESTAURANT_SLUG } from './test-restaurant'

/**
 * Resets the test restaurant's 6 QR-ordering columns to a known canonical
 * pattern (auto-accept on, item notes on, NL+EN menu, default accent
 * colour, both payment modes on).
 *
 * `qr_pay_at_table_enabled` is pinned to `true` — NOT the schema default
 * (`false`). `tests/e2e/qr/pay-at-table.spec.ts` depends on this exact
 * restaurant having pay-at-table enabled (flipped on out-of-band before
 * that spec was written, per its own header comment) and nothing else in
 * the codebase ever resets `qr_*` columns, so this is the first fixture
 * that touches them — resetting to the *schema* default here would silently
 * break that unrelated spec. Grepped before picking values, per the D5.2
 * T1-seats / D5.3 / D5.4 lesson.
 *
 * `service_qr_enabled` is NOT touched here — out of scope for D5.5 (a
 * bigger services-enable unit) and already `true` on the test restaurant,
 * which is the state every spec in this file needs by default. The one
 * test that needs it `false` (informational-card state) flips it directly
 * and restores in `finally`.
 *
 * Never writes `qr_item_notes_allowed` — that column is dropped by D5.5's
 * migration and no code reads or writes it anymore.
 *
 * Restaurant-id-scoped with a hard-coded allowlist, same shape as
 * resetTestRestaurantHours / resetTestRestaurantFloor /
 * resetTestRestaurantBookingRules / resetTestRestaurantOrdering.
 */
export async function resetTestRestaurantQrSettings(restaurantId: string = TEST_RESTAURANT_ID): Promise<void> {
  if (restaurantId !== TEST_RESTAURANT_ID) {
    throw new Error(
      `resetTestRestaurantQrSettings refuses to touch restaurant ${restaurantId}. ` +
        `Only ${TEST_RESTAURANT_ID} (${TEST_RESTAURANT_SLUG}) is permitted.`,
    )
  }

  const supabase = adminClient()
  const { error } = await supabase
    .from('restaurants')
    .update({
      qr_auto_accept: true,
      qr_item_notes_enabled: true,
      qr_menu_language: 'nl_en',
      qr_widget_accent_color: '#d4820a',
      qr_pay_now_enabled: true,
      qr_pay_at_table_enabled: true,
    })
    .eq('id', restaurantId)

  if (error) {
    throw new Error(`resetTestRestaurantQrSettings failed: ${error.message}`)
  }
}

/** QR-ordering columns for the test restaurant, for direct DB assertions in specs. */
export async function getQrSettingsConfig(restaurantId: string = TEST_RESTAURANT_ID) {
  if (restaurantId !== TEST_RESTAURANT_ID) {
    throw new Error(
      `getQrSettingsConfig refuses to read restaurant ${restaurantId}. ` +
        `Only ${TEST_RESTAURANT_ID} (${TEST_RESTAURANT_SLUG}) is permitted.`,
    )
  }
  const supabase = adminClient()
  const { data, error } = await supabase
    .from('restaurants')
    .select(
      'qr_auto_accept, qr_item_notes_enabled, qr_menu_language, qr_widget_accent_color, qr_pay_now_enabled, qr_pay_at_table_enabled, service_qr_enabled',
    )
    .eq('id', restaurantId)
    .single()
  if (error) {
    throw new Error(`getQrSettingsConfig failed: ${error.message}`)
  }
  return data
}
