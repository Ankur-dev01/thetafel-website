import { test, expect } from './fixtures/base'
import { adminClient, TEST_RESTAURANT_ID, TEST_RESTAURANT_ZONE_ID } from './fixtures/test-restaurant'
import { signInAsTestOwner } from './fixtures/dashboard-auth'
import { resetTestRestaurantFloor, getFloorTables } from './fixtures/resetTestRestaurantFloor'
import { seedBookingsDay, cleanupSeededGuests } from './fixtures/seed-bookings-day'

// A real restaurant + table + zone from the same tables — used only to
// prove the route never touches anything but the caller's own restaurant.
// Never written to.
const OTHER_RESTAURANT_ID = '288b0437-81da-4089-98e4-d89227a98004'
const OTHER_RESTAURANT_TABLE_ID = '01f2d194-ff2f-428c-b3a3-a55dd3c42e5e'
const OTHER_RESTAURANT_ZONE_ID = 'afdca114-17b4-46cb-8548-4bfa47f893c8'

async function tableIdByLabel(label: string): Promise<string> {
  const rows = await getFloorTables()
  const row = rows.find((r) => r.label === label)
  if (!row) throw new Error(`fixture table with label ${label} not found`)
  return row.id as string
}

test.describe('Settings — floor plan editor (D5.2)', () => {
  test.beforeEach(async () => {
    await resetTestRestaurantFloor()
  })

  test('T1: load reflects DB seed', async ({ page }) => {
    const t1 = await tableIdByLabel('T1')
    const t2 = await tableIdByLabel('T2')
    const t3 = await tableIdByLabel('T3')
    const t4 = await tableIdByLabel('T4')

    await signInAsTestOwner(page)
    await page.goto('/dashboard/settings/floor')

    await expect(page.locator(`[data-testid="floor-zone-${TEST_RESTAURANT_ZONE_ID}-name"]`)).toHaveValue('Zaal')
    await expect(page.locator(`[data-testid="floor-table-${t1}-label"]`)).toHaveValue('T1')
    await expect(page.locator(`[data-testid="floor-table-${t1}-seats"]`)).toHaveValue('4')
    await expect(page.locator(`[data-testid="floor-table-${t2}-seats"]`)).toHaveValue('2')
    await expect(page.locator(`[data-testid="floor-table-${t3}-seats"]`)).toHaveValue('4')
    await expect(page.locator(`[data-testid="floor-table-${t4}-seats"]`)).toHaveValue('4')
  })

  test('T2: add a new table, save, reload, persists', async ({ page }) => {
    await signInAsTestOwner(page)
    await page.goto('/dashboard/settings/floor')

    const zoneLocator = page.locator(`[data-testid="floor-zone-${TEST_RESTAURANT_ZONE_ID}"]`)
    await zoneLocator.locator(`[data-testid="floor-add-table-${TEST_RESTAURANT_ZONE_ID}"]`).click()

    // Natural sort re-renders as soon as the label changes, so pin to the
    // exact testid captured right after the row appears rather than a
    // position-based locator (`.first()`/`.last()`), which would drift once
    // the new label re-sorts the row within the zone card.
    const newRowTestId = await zoneLocator.locator('[data-testid^="floor-table-"]').first().getAttribute('data-testid')
    const newRow = page.locator(`[data-testid="${newRowTestId}"]`)
    await newRow.locator('[data-testid$="-label"]').fill('T5')
    await newRow.locator('[data-testid$="-seats"]').fill('6')

    await expect(page.locator('[data-testid="floor-save"]')).toBeEnabled()
    await page.locator('[data-testid="floor-save"]').click()
    await expect(page.locator('[data-testid="floor-saved-toast"]')).toBeVisible()

    await page.reload()
    const t5Id = await tableIdByLabel('T5')
    await expect(page.locator(`[data-testid="floor-table-${t5Id}-seats"]`)).toHaveValue('6')

    const rows = await getFloorTables()
    const t5 = rows.find((r) => r.label === 'T5')
    expect(t5?.seats).toBe(6)
    expect(t5?.zone_id).toBe(TEST_RESTAURANT_ZONE_ID)
    // No printed QR code exists yet for a dashboard-added table — forced off
    // server-side regardless of the client default (see route.ts).
    expect(t5?.is_qr_enabled).toBe(false)
  })

  test('T3: rename + change capacity on an existing table', async ({ page }) => {
    const t2Id = await tableIdByLabel('T2')

    await signInAsTestOwner(page)
    await page.goto('/dashboard/settings/floor')

    await page.locator(`[data-testid="floor-table-${t2Id}-label"]`).fill('T2-Renamed')
    await page.locator(`[data-testid="floor-table-${t2Id}-seats"]`).fill('5')
    await page.locator('[data-testid="floor-save"]').click()
    await expect(page.locator('[data-testid="floor-saved-toast"]')).toBeVisible()

    const rows = await getFloorTables()
    const renamed = rows.find((r) => r.id === t2Id)
    expect(renamed?.label).toBe('T2-Renamed')
    expect(renamed?.seats).toBe(5)
  })

  test('T4: toggle is_bookable off', async ({ page }) => {
    const t3Id = await tableIdByLabel('T3')

    await signInAsTestOwner(page)
    await page.goto('/dashboard/settings/floor')

    await page.locator(`[data-testid="floor-table-${t3Id}-bookable"]`).uncheck()
    await page.locator('[data-testid="floor-save"]').click()
    await expect(page.locator('[data-testid="floor-saved-toast"]')).toBeVisible()

    const rows = await getFloorTables()
    const t3 = rows.find((r) => r.id === t3Id)
    expect(t3?.is_bookable).toBe(false)
  })

  test('T5: delete a table with no bookings', async ({ page }) => {
    const t4Id = await tableIdByLabel('T4')
    page.on('dialog', (d) => d.accept())

    await signInAsTestOwner(page)
    await page.goto('/dashboard/settings/floor')

    await page.locator(`[data-testid="floor-table-${t4Id}-delete"]`).click()
    await page.locator('[data-testid="floor-save"]').click()
    await expect(page.locator('[data-testid="floor-saved-toast"]')).toBeVisible()

    const { data: row } = await adminClient().from('restaurant_tables').select('deleted_at').eq('id', t4Id).single()
    expect(row?.deleted_at).not.toBeNull()

    const remaining = await getFloorTables()
    expect(remaining.find((r) => r.id === t4Id)).toBeUndefined()
  })

  test('T6: delete-blocked by a future booking', async ({ page }) => {
    const t4Id = await tableIdByLabel('T4')
    const t2Id = await tableIdByLabel('T2')
    page.on('dialog', (d) => d.accept())

    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const seeded = await seedBookingsDay({
      restaurantId: TEST_RESTAURANT_ID,
      civilDate: futureDate,
      bookings: [
        {
          localTime: '19:00',
          partySize: 4,
          status: 'confirmed',
          zoneId: TEST_RESTAURANT_ZONE_ID,
          tableIds: [t4Id],
        },
      ],
    })

    try {
      await signInAsTestOwner(page)
      await page.goto('/dashboard/settings/floor')

      // An unrelated unsaved edit alongside the blocked delete — must
      // survive the failed save untouched (zero-writes-on-block contract).
      await page.locator(`[data-testid="floor-table-${t2Id}-seats"]`).fill('7')
      await page.locator(`[data-testid="floor-table-${t4Id}-delete"]`).click()
      await page.locator('[data-testid="floor-save"]').click()

      await expect(page.locator('[data-testid="floor-blocked-error"]')).toContainText('T4')
      await expect(page.locator(`[data-testid="floor-table-${t2Id}-seats"]`)).toHaveValue('7')

      const rows = await getFloorTables()
      expect(rows.find((r) => r.id === t4Id)).toBeDefined()
      const t2 = rows.find((r) => r.id === t2Id)
      expect(t2?.seats).toBe(2) // unsaved — DB still has the pre-edit value
    } finally {
      await cleanupSeededGuests(seeded.guestIds)
    }
  })

  // T7 (rate limit fires) is not runnable against this suite's e2e setup —
  // same rationale as D5.1's T7: playwright.config.ts always boots the
  // server via `npm run dev`, and dashboardMutationRateLimit() unconditionally
  // bypasses the Redis check when NODE_ENV === 'development'.
  test.skip('T7: rate limit fires (unreachable in dev-mode e2e — see comment above)', async () => {})

  test('T8: cross-restaurant safety', async ({ page }) => {
    const { data: before } = await adminClient()
      .from('restaurant_tables')
      .select('id')
      .eq('restaurant_id', OTHER_RESTAURANT_ID)

    await signInAsTestOwner(page)
    await page.goto('/dashboard/settings/floor')

    // Attempt to smuggle Karan's zone/table ids into a save from the test
    // owner's own session. The route resolves the restaurant from the
    // session (resolveMenuMutationContext), then re-loads ITS OWN known
    // zone/table ids fresh from the DB before validating — Karan's ids are
    // never in that set, so this must be rejected before any write happens.
    const res = await page.request.post('/api/dashboard/settings/floor', {
      data: {
        zones: [{ id: OTHER_RESTAURANT_ZONE_ID, name: 'Hijacked', display_order: 0 }],
        tables: [
          {
            id: OTHER_RESTAURANT_TABLE_ID,
            zone_id: OTHER_RESTAURANT_ZONE_ID,
            label: 'Hijacked',
            seats: 2,
            is_bookable: true,
            is_qr_enabled: true,
          },
        ],
        deletedTableIds: [],
      },
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('validation_error')

    const { data: after } = await adminClient()
      .from('restaurant_tables')
      .select('id')
      .eq('restaurant_id', OTHER_RESTAURANT_ID)
    expect(after?.length ?? 0).toBe(before?.length ?? 0)

    const { data: otherTable } = await adminClient()
      .from('restaurant_tables')
      .select('label')
      .eq('id', OTHER_RESTAURANT_TABLE_ID)
      .single()
    expect(otherTable?.label).not.toBe('Hijacked')
  })
})
