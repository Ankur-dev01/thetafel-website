import { randomUUID } from 'node:crypto'
import {
  adminClient,
  TEST_RESTAURANT_ID,
  TEST_RESTAURANT_SLUG,
  TEST_RESTAURANT_ZONE_ID,
  TEST_RESTAURANT_TABLE_ID,
  TEST_RESTAURANT_TABLE_QR_TOKEN,
} from './test-restaurant'

/**
 * Resets the test restaurant's floor plan to a known canonical pattern:
 * one zone ("Zaal", id=TEST_RESTAURANT_ZONE_ID) containing four tables —
 * T1/4, T2/2, T3/4, T4/4 (label/seats).
 *
 * T1 is NOT a throwaway row: at least a dozen other spec/fixture files
 * hardcode `TEST_RESTAURANT_TABLE_ID` and `TEST_RESTAURANT_TABLE_QR_TOKEN`
 * (booking_tables inserts, QR-scan URL navigation, a walk-in dialog
 * data-testid keyed on the raw id). This reset UPDATEs that exact row back
 * to canonical values rather than deleting and recreating it — its id and
 * qr_token must never change. Seats is pinned at **4**, not a fresh
 * "canonical" value picked for this unit: `booking-actions.spec.ts` and
 * `walk-in.spec.ts` both hardcode "4-seat table" half-full-rule assertions
 * against this exact table (e.g. "4 <= 2*2" comments), discovered the hard
 * way when an earlier draft of this fixture set it to 2 and broke three
 * unrelated specs. T2-T4 are pure fixture data with no external consumers:
 * they're hard-deleted and recreated fresh every reset, with a new random
 * qr_token each run (global UNIQUE(qr_token), so reusing a fixed token
 * across runs would only matter if two runs overlapped, which they don't
 * under workers:1).
 *
 * Restaurant-id-scoped with a hard-coded allowlist, same shape as
 * resetTestRestaurantPauseState / resetTestRestaurantHours — this must
 * never be callable against a real restaurant's floor plan.
 */
export async function resetTestRestaurantFloor(restaurantId: string = TEST_RESTAURANT_ID): Promise<void> {
  if (restaurantId !== TEST_RESTAURANT_ID) {
    throw new Error(
      `resetTestRestaurantFloor refuses to touch restaurant ${restaurantId}. ` +
        `Only ${TEST_RESTAURANT_ID} (${TEST_RESTAURANT_SLUG}) is permitted.`,
    )
  }

  const supabase = adminClient()

  // Exactly one zone: upsert-by-id so TEST_RESTAURANT_ZONE_ID never drifts,
  // and delete any other zone a stray test might have left behind (D5.2
  // ships no zone-create UI, so any extra zone here is fixture leakage, not
  // real product state).
  const { error: zoneUpsertError } = await supabase.from('zones').upsert(
    {
      id: TEST_RESTAURANT_ZONE_ID,
      restaurant_id: restaurantId,
      name: 'Zaal',
      display_order: 0,
      deleted_at: null,
    },
    { onConflict: 'id' },
  )
  if (zoneUpsertError) {
    throw new Error(`resetTestRestaurantFloor failed (zone upsert): ${zoneUpsertError.message}`)
  }

  const { error: extraZoneError } = await supabase
    .from('zones')
    .delete()
    .eq('restaurant_id', restaurantId)
    .neq('id', TEST_RESTAURANT_ZONE_ID)
  if (extraZoneError) {
    throw new Error(`resetTestRestaurantFloor failed (extra zone cleanup): ${extraZoneError.message}`)
  }

  // The hardcoded table: reset in place, never delete/recreate.
  const { error: tableUpdateError } = await supabase
    .from('restaurant_tables')
    .update({
      zone_id: TEST_RESTAURANT_ZONE_ID,
      label: 'T1',
      seats: 4,
      is_bookable: true,
      is_qr_enabled: true,
      deleted_at: null,
      qr_token: TEST_RESTAURANT_TABLE_QR_TOKEN,
    })
    .eq('id', TEST_RESTAURANT_TABLE_ID)
    .eq('restaurant_id', restaurantId)
  if (tableUpdateError) {
    throw new Error(`resetTestRestaurantFloor failed (T1 reset): ${tableUpdateError.message}`)
  }

  // Every other table for this restaurant is ephemeral fixture data — wipe
  // and reseed. Safe to hard-delete: this fixture runs after
  // wipeTestRestaurant's booking/booking_tables cleanup, so nothing
  // references these ids by the time we get here.
  const { error: extraTablesError } = await supabase
    .from('restaurant_tables')
    .delete()
    .eq('restaurant_id', restaurantId)
    .neq('id', TEST_RESTAURANT_TABLE_ID)
  if (extraTablesError) {
    throw new Error(`resetTestRestaurantFloor failed (extra table cleanup): ${extraTablesError.message}`)
  }

  const seedRows = [
    { label: 'T2', seats: 2 },
    { label: 'T3', seats: 4 },
    { label: 'T4', seats: 4 },
  ].map((row) => ({
    restaurant_id: restaurantId,
    zone_id: TEST_RESTAURANT_ZONE_ID,
    label: row.label,
    seats: row.seats,
    is_bookable: true,
    is_qr_enabled: true,
    qr_token: randomUUID(),
    qr_image_path: null,
  }))

  const { error: insertError } = await supabase.from('restaurant_tables').insert(seedRows)
  if (insertError) {
    throw new Error(`resetTestRestaurantFloor failed (seed insert): ${insertError.message}`)
  }
}

/** Non-deleted zones + tables for the test restaurant, for direct DB assertions in specs. */
export async function getFloorTables(restaurantId: string = TEST_RESTAURANT_ID) {
  if (restaurantId !== TEST_RESTAURANT_ID) {
    throw new Error(
      `getFloorTables refuses to read restaurant ${restaurantId}. ` +
        `Only ${TEST_RESTAURANT_ID} (${TEST_RESTAURANT_SLUG}) is permitted.`,
    )
  }
  const supabase = adminClient()
  const { data, error } = await supabase
    .from('restaurant_tables')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .order('label', { ascending: true })
  if (error) {
    throw new Error(`getFloorTables failed: ${error.message}`)
  }
  return data ?? []
}
