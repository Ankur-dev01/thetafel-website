import { test, expect } from '../fixtures/base'
import { adminClient, wipeTestRestaurant, TEST_RESTAURANT_ID } from '../fixtures/test-restaurant'
import { resetTestRestaurantPauseState } from '../fixtures/resetTestRestaurantPauseState'

// A real restaurant id from the same table — used only to prove the safety
// check refuses it. Never written to.
const OTHER_RESTAURANT_ID = 'b619a1bd-6c53-4049-ac4d-05ffe149864f'

async function getPauseColumns() {
  const { data } = await adminClient()
    .from('restaurants')
    .select('paused_at, paused_by, pause_reason, grace_period_started_at')
    .eq('id', TEST_RESTAURANT_ID)
    .single()
  return data
}

test.describe('Pause fixture-leak regression (D4.5)', () => {
  test('wipeTestRestaurant recovers from a leaked pause state', async () => {
    // Simulate exactly what pause.spec.ts used to leave behind before D4.5:
    // a pause write with no cleanup ever having run. `pause_reason` is
    // constrained by `restaurants_pause_reason_check` to null/'manual'/
    // 'billing_suspended' — same two values pause.spec.ts's own setPaused()
    // uses, not an arbitrary string.
    const { error } = await adminClient()
      .from('restaurants')
      .update({
        paused_at: new Date().toISOString(),
        paused_by: null,
        pause_reason: 'manual',
        grace_period_started_at: new Date().toISOString(),
      })
      .eq('id', TEST_RESTAURANT_ID)
    expect(error).toBeNull()

    const leaked = await getPauseColumns()
    expect(leaked?.paused_at).not.toBeNull()
    expect(leaked?.pause_reason).toBe('manual')
    expect(leaked?.grace_period_started_at).not.toBeNull()

    // This is the fix under test: wipeTestRestaurant is called at the top of
    // nearly every spec in the suite, so if it clears pause state, a leak
    // from any prior test self-heals on the very next test that runs.
    await wipeTestRestaurant()

    const cleaned = await getPauseColumns()
    expect(cleaned?.paused_at).toBeNull()
    expect(cleaned?.paused_by).toBeNull()
    expect(cleaned?.pause_reason).toBeNull()
    expect(cleaned?.grace_period_started_at).toBeNull()
  })

  test('resetTestRestaurantPauseState refuses to touch a different restaurant', async () => {
    // OTS is a real restaurant, not a fixture — don't assume its current
    // pause state, just prove this call can't change it either way.
    const { data: before } = await adminClient()
      .from('restaurants')
      .select('paused_at, paused_by, pause_reason, grace_period_started_at')
      .eq('id', OTHER_RESTAURANT_ID)
      .single()

    await expect(resetTestRestaurantPauseState(OTHER_RESTAURANT_ID)).rejects.toThrow(/refuses to touch/)

    const { data: after } = await adminClient()
      .from('restaurants')
      .select('paused_at, paused_by, pause_reason, grace_period_started_at')
      .eq('id', OTHER_RESTAURANT_ID)
      .single()
    expect(after).toEqual(before)
  })

  test('resetTestRestaurantPauseState is idempotent', async () => {
    await resetTestRestaurantPauseState()
    await resetTestRestaurantPauseState()
    await resetTestRestaurantPauseState()

    const cleaned = await getPauseColumns()
    expect(cleaned?.paused_at).toBeNull()
  })
})
