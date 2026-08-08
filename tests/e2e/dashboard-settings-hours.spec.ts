import { test, expect } from './fixtures/base'
import { adminClient, TEST_RESTAURANT_ID } from './fixtures/test-restaurant'
import { signInAsTestOwner } from './fixtures/dashboard-auth'
import { resetTestRestaurantHours, getAvailabilityRows } from './fixtures/resetTestRestaurantHours'

// A real restaurant id from the same table — used only to prove the route
// never touches anything but the caller's own restaurant. Never written to.
const OTHER_RESTAURANT_ID = 'b619a1bd-6c53-4049-ac4d-05ffe149864f'

async function setCustomHours(
  rows: Array<{
    day_of_week: number
    open_time: string
    close_time: string
    closes_next_day?: boolean
  }>,
): Promise<void> {
  const supabase = adminClient()
  await supabase.from('availability').delete().eq('restaurant_id', TEST_RESTAURANT_ID)
  await supabase.from('restaurants').update({ hours_per_service_override: false }).eq('id', TEST_RESTAURANT_ID)
  if (rows.length === 0) return
  const { error } = await supabase.from('availability').insert(
    rows.map((row) => ({
      restaurant_id: TEST_RESTAURANT_ID,
      service_scope: 'all',
      is_active: true,
      tag_brunch: false,
      tag_lunch: false,
      tag_dinner: false,
      closes_next_day: false,
      ...row,
    })),
  )
  if (error) throw new Error(`setCustomHours failed: ${error.message}`)
}

test.describe('Settings — opening hours editor (D5.1)', () => {
  test.beforeEach(async () => {
    await resetTestRestaurantHours()
  })

  test('T1: initial load reflects DB state', async ({ page }) => {
    await setCustomHours([
      { day_of_week: 1, open_time: '09:00', close_time: '17:00' },
      { day_of_week: 2, open_time: '09:00', close_time: '17:00' },
      { day_of_week: 3, open_time: '09:00', close_time: '17:00' },
      { day_of_week: 4, open_time: '09:00', close_time: '17:00' },
      { day_of_week: 5, open_time: '09:00', close_time: '17:00' },
      { day_of_week: 6, open_time: '10:00', close_time: '16:00' },
      // Sunday: no row — closed.
    ])

    await signInAsTestOwner(page)
    await page.goto('/dashboard/settings/hours')

    for (const day of [1, 2, 3, 4, 5]) {
      await expect(page.locator(`[data-testid="hours-row-all-${day}-open"]`)).toHaveValue('09:00')
      await expect(page.locator(`[data-testid="hours-row-all-${day}-close"]`)).toHaveValue('17:00')
    }
    await expect(page.locator('[data-testid="hours-row-all-6-open"]')).toHaveValue('10:00')
    await expect(page.locator('[data-testid="hours-row-all-6-close"]')).toHaveValue('16:00')

    await expect(page.locator('[data-testid="hours-row-all-7-closed"]')).toBeChecked()
    await expect(page.locator('[data-testid="hours-row-all-7-open"]')).toHaveCount(0)
  })

  test('T2: edit and save weekly hours', async ({ page }) => {
    await signInAsTestOwner(page)
    await page.goto('/dashboard/settings/hours')

    await page.locator('[data-testid="hours-row-all-1-close"]').fill('18:00')
    await page.locator('[data-testid="hours-row-all-3-closed"]').check()
    await page.locator('[data-testid="hours-row-all-5-tag-dinner"]').check()

    await expect(page.locator('[data-testid="hours-save"]')).toBeEnabled()
    await page.locator('[data-testid="hours-save"]').click()
    await expect(page.locator('[data-testid="hours-saved-toast"]')).toBeVisible()

    await page.reload()
    await expect(page.locator('[data-testid="hours-row-all-1-close"]')).toHaveValue('18:00')
    await expect(page.locator('[data-testid="hours-row-all-3-closed"]')).toBeChecked()
    await expect(page.locator('[data-testid="hours-row-all-5-tag-dinner"]')).toBeChecked()

    const rows = await getAvailabilityRows()
    const mon = rows.find((r) => r.day_of_week === 1 && r.service_scope === 'all')
    const wed = rows.find((r) => r.day_of_week === 3 && r.service_scope === 'all')
    const fri = rows.find((r) => r.day_of_week === 5 && r.service_scope === 'all')
    expect(mon?.close_time).toBe('18:00:00')
    expect(wed).toBeUndefined()
    expect(fri?.tag_dinner).toBe(true)
  })

  test('T3: closes_next_day flow', async ({ page }) => {
    await signInAsTestOwner(page)
    await page.goto('/dashboard/settings/hours')

    await page.locator('[data-testid="hours-row-all-5-open"]').fill('18:00')
    await page.locator('[data-testid="hours-row-all-5-close"]').fill('02:00')
    await expect(page.locator('[data-testid="hours-row-all-5-next-day"]')).toBeVisible()

    await page.locator('[data-testid="hours-save"]').click()
    await expect(page.locator('[data-testid="hours-saved-toast"]')).toBeVisible()

    const rows = await getAvailabilityRows()
    const fri = rows.find((r) => r.day_of_week === 5 && r.service_scope === 'all')
    expect(fri?.close_time).toBe('02:00:00')
    expect(fri?.closes_next_day).toBe(true)
  })

  test('T4: validation blocks save', async ({ page }) => {
    await signInAsTestOwner(page)
    await page.goto('/dashboard/settings/hours')

    await page.locator('[data-testid="hours-row-all-1-open"]').fill('12:00')
    await page.locator('[data-testid="hours-row-all-1-close"]').fill('12:00')
    await expect(page.locator('[data-testid="hours-row-all-1-error"]')).toBeVisible()
    await expect(page.locator('[data-testid="hours-save"]')).toBeDisabled()

    await page.locator('[data-testid="hours-row-all-1-close"]').fill('18:00')
    await page.locator('[data-testid="hours-row-all-2-open"]').fill('10:00')
    await page.locator('[data-testid="hours-row-all-2-close"]').fill('')
    await expect(page.locator('[data-testid="hours-row-all-2-error"]')).toBeVisible()
    await expect(page.locator('[data-testid="hours-save"]')).toBeDisabled()
  })

  test('T5: toggle per-service override on', async ({ page }) => {
    page.on('dialog', (d) => d.accept())
    await signInAsTestOwner(page)
    await page.goto('/dashboard/settings/hours')

    await page.locator('[data-testid="hours-override-toggle"]').check()

    for (const scope of ['reservations', 'takeaway', 'qr']) {
      await page.locator(`[data-testid="hours-row-${scope}-1-closed"]`).uncheck()
      await page.locator(`[data-testid="hours-row-${scope}-1-open"]`).fill('09:00')
      await page.locator(`[data-testid="hours-row-${scope}-1-close"]`).fill('20:00')
    }

    await page.locator('[data-testid="hours-save"]').click()
    await expect(page.locator('[data-testid="hours-saved-toast"]')).toBeVisible()

    const rows = await getAvailabilityRows()
    const monRows = rows.filter((r) => r.day_of_week === 1)
    expect(monRows).toHaveLength(3)
    expect(monRows.every((r) => r.service_scope !== 'all')).toBe(true)
    expect(rows.some((r) => r.service_scope === 'all')).toBe(false)

    const { data: restaurant } = await adminClient()
      .from('restaurants')
      .select('hours_per_service_override')
      .eq('id', TEST_RESTAURANT_ID)
      .single()
    expect(restaurant?.hours_per_service_override).toBe(true)
  })

  test('T6: toggle per-service override off', async ({ page }) => {
    page.on('dialog', (d) => d.accept())

    // Start from a per-service state.
    const supabase = adminClient()
    await supabase.from('availability').delete().eq('restaurant_id', TEST_RESTAURANT_ID)
    await supabase.from('restaurants').update({ hours_per_service_override: true }).eq('id', TEST_RESTAURANT_ID)
    await supabase.from('availability').insert(
      ['reservations', 'takeaway', 'qr'].map((scope) => ({
        restaurant_id: TEST_RESTAURANT_ID,
        day_of_week: 1,
        service_scope: scope,
        open_time: '09:00',
        close_time: '20:00',
        closes_next_day: false,
        is_active: true,
        tag_brunch: false,
        tag_lunch: false,
        tag_dinner: false,
      })),
    )

    await signInAsTestOwner(page)
    await page.goto('/dashboard/settings/hours')

    await page.locator('[data-testid="hours-override-toggle"]').uncheck()
    // The 'all' scope has no rows yet (this restaurant only had per-service
    // rows), so Monday starts closed under the unified card too.
    await page.locator('[data-testid="hours-row-all-1-closed"]').uncheck()
    await page.locator('[data-testid="hours-row-all-1-open"]').fill('11:00')
    await page.locator('[data-testid="hours-row-all-1-close"]').fill('22:00')

    await page.locator('[data-testid="hours-save"]').click()
    await expect(page.locator('[data-testid="hours-saved-toast"]')).toBeVisible()

    const rows = await getAvailabilityRows()
    const monRows = rows.filter((r) => r.day_of_week === 1)
    expect(monRows).toHaveLength(1)
    expect(monRows[0].service_scope).toBe('all')

    const { data: restaurant } = await adminClient()
      .from('restaurants')
      .select('hours_per_service_override')
      .eq('id', TEST_RESTAURANT_ID)
      .single()
    expect(restaurant?.hours_per_service_override).toBe(false)
  })

  // T7 (rate limit fires) is not runnable against this suite's e2e setup:
  // playwright.config.ts always boots the server via `npm run dev`, and
  // dashboardMutationRateLimit() unconditionally bypasses the Redis check
  // when NODE_ENV === 'development' (see lib/dashboard/rateLimit.ts). There
  // is no production-mode e2e run in this repo to exercise the 429 path
  // against, and no other dashboard mutation spec attempts it either.
  test.skip('T7: rate limit fires (unreachable in dev-mode e2e — see comment above)', async () => {})

  test('T8: cross-restaurant safety', async ({ page }) => {
    const { data: before } = await adminClient()
      .from('availability')
      .select('id')
      .eq('restaurant_id', OTHER_RESTAURANT_ID)

    await signInAsTestOwner(page)
    await page.goto('/dashboard/settings/hours')

    // The route only ever writes to the restaurant resolved from the caller's
    // own session (resolveMenuMutationContext) — there is no field in the
    // request body that names a restaurant at all, so there is nothing to
    // "spoof" here. This proves that directly: a normal save from the test
    // owner's session cannot move rows onto another restaurant's id.
    await page.locator('[data-testid="hours-row-all-1-close"]').fill('19:00')
    await page.locator('[data-testid="hours-save"]').click()
    await expect(page.locator('[data-testid="hours-saved-toast"]')).toBeVisible()

    const { data: after } = await adminClient()
      .from('availability')
      .select('id')
      .eq('restaurant_id', OTHER_RESTAURANT_ID)
    expect(after?.length ?? 0).toBe(before?.length ?? 0)
  })
})
