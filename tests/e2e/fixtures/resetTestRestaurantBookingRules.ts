import { adminClient, TEST_RESTAURANT_ID, TEST_RESTAURANT_SLUG } from './test-restaurant'

/**
 * Resets the test restaurant's 17 booking-rules columns to a known
 * canonical pattern. Targets `max_party_size_online`, never the dead
 * sibling `max_party_size` column (see bookingRulesValidation.ts's header
 * comment) — this fixture doesn't touch `max_party_size` at all.
 *
 * `noshow_prepaid_enabled` is pinned to `false` (not a fresh "canonical"
 * choice) — `tests/e2e/booking/happy-path.spec.ts` hardcodes a 4-visible-step
 * wizard assertion that only holds when prepaid is off for this restaurant
 * (comment: "one zone, no deposit config"). Grepped before picking values,
 * per the D5.2 T1-seats lesson — this was the only cross-spec dependency
 * found on any of these columns.
 *
 * `noshow_prepaid_window` (day/time deposit gating) is never read or
 * written here — out of scope for D5.3, existing values (null on the test
 * restaurant) are left untouched.
 *
 * `subscription_tier` / `mollie_status` / `mollie_access_token` /
 * `mollie_token_expires_at` are also left untouched — they're not part of
 * the 17 booking-rules columns. The test restaurant's tier is already
 * non-Premium (null) and Mollie is already not verified, which is exactly
 * the "gate active" state the WhatsApp/prepaid gating specs need by
 * default; specs that need the opposite state swap it themselves and
 * restore in `finally`.
 *
 * Restaurant-id-scoped with a hard-coded allowlist, same shape as
 * resetTestRestaurantHours / resetTestRestaurantFloor.
 */
export async function resetTestRestaurantBookingRules(restaurantId: string = TEST_RESTAURANT_ID): Promise<void> {
  if (restaurantId !== TEST_RESTAURANT_ID) {
    throw new Error(
      `resetTestRestaurantBookingRules refuses to touch restaurant ${restaurantId}. ` +
        `Only ${TEST_RESTAURANT_ID} (${TEST_RESTAURANT_SLUG}) is permitted.`,
    )
  }

  const supabase = adminClient()

  const canonicalNl =
    'Beste {naam},\n\nBedankt voor je reservering bij {restaurant}. We kijken ernaar uit je te ontvangen op {datum} om {tijd} voor {gasten}.\n\nAdres: {adres}\n\nTot snel,\n{restaurant}'
  const canonicalEn =
    'Dear {naam},\n\nThanks for booking with {restaurant}. We look forward to welcoming you on {datum} at {tijd} for {gasten}.\n\nAddress: {adres}\n\nSee you soon,\n{restaurant}'

  const { error } = await supabase
    .from('restaurants')
    .update({
      min_lead_time_minutes: 60,
      max_party_size_online: 8,
      booking_window_days: 90,
      max_guests_per_slot: null,
      waitlist_enabled: true,
      guest_zone_choice_enabled: true,
      noshow_reminders_email_enabled: true,
      noshow_reminders_whatsapp_enabled: false,
      noshow_reconfirmation_enabled: false,
      noshow_prepaid_enabled: false,
      noshow_prepaid_amount_cents: null,
      noshow_prepaid_threshold: null,
      confirmation_template_nl: canonicalNl,
      confirmation_template_en: canonicalEn,
      booking_question_allergies: true,
      booking_question_occasion: true,
      booking_question_requests: true,
    })
    .eq('id', restaurantId)

  if (error) {
    throw new Error(`resetTestRestaurantBookingRules failed: ${error.message}`)
  }
}

/** Booking-rules columns for the test restaurant, for direct DB assertions in specs. */
export async function getBookingRules(restaurantId: string = TEST_RESTAURANT_ID) {
  if (restaurantId !== TEST_RESTAURANT_ID) {
    throw new Error(
      `getBookingRules refuses to read restaurant ${restaurantId}. ` +
        `Only ${TEST_RESTAURANT_ID} (${TEST_RESTAURANT_SLUG}) is permitted.`,
    )
  }
  const supabase = adminClient()
  const { data, error } = await supabase
    .from('restaurants')
    .select(
      'min_lead_time_minutes, max_party_size_online, booking_window_days, max_guests_per_slot, waitlist_enabled, guest_zone_choice_enabled, noshow_reminders_email_enabled, noshow_reminders_whatsapp_enabled, noshow_reconfirmation_enabled, noshow_prepaid_enabled, noshow_prepaid_amount_cents, noshow_prepaid_threshold, confirmation_template_nl, confirmation_template_en, booking_question_allergies, booking_question_occasion, booking_question_requests, subscription_tier, mollie_status',
    )
    .eq('id', restaurantId)
    .single()
  if (error) {
    throw new Error(`getBookingRules failed: ${error.message}`)
  }
  return data
}
