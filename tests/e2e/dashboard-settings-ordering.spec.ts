import { test, expect } from './fixtures/base'
import { adminClient, TEST_RESTAURANT_ID, TEST_RESTAURANT_SLUG } from './fixtures/test-restaurant'
import { signInAsTestOwner } from './fixtures/dashboard-auth'
import { getOrderingConfig, resetTestRestaurantOrdering } from './fixtures/resetTestRestaurantOrdering'

// A real restaurant id from the same table — used only to prove the route
// never touches anything but the caller's own restaurant. Never written to.
const OTHER_RESTAURANT_ID = '288b0437-81da-4089-98e4-d89227a98004'

async function setServiceTakeawayEnabled(value: boolean): Promise<void> {
  const { error } = await adminClient()
    .from('restaurants')
    .update({ service_takeaway_enabled: value })
    .eq('id', TEST_RESTAURANT_ID)
  if (error) throw new Error(`setServiceTakeawayEnabled failed: ${error.message}`)
}

test.describe('Settings — ordering (takeaway) editor (D5.4)', () => {
  // Per the D5.3 lesson: every test starts from the canonical seed so state
  // mutated by one test (accepting-orders off, service disabled, etc.)
  // never leaks into the next.
  test.beforeEach(async () => {
    await resetTestRestaurantOrdering()
  })

  test('T1: page load reflects current values', async ({ page }) => {
    await signInAsTestOwner(page)
    await page.goto('/dashboard/settings/ordering')

    await expect(page.locator('[data-testid="ordering-accepting-orders"]')).toBeChecked()
    await expect(page.locator('[data-testid="ordering-prep-time"]')).toHaveValue('20')
    await expect(page.locator('[data-testid="ordering-slot-interval"]')).toHaveValue('15')
    await expect(page.locator('[data-testid="ordering-min-order"]')).toHaveValue('0.00')
    await expect(page.locator('[data-testid="ordering-item-notes"]')).toBeChecked()
    await expect(page.locator('[data-testid="ordering-scheduled-orders"]')).not.toBeChecked()
  })

  test('T2: change prep time, min order, item notes toggle, save, reload, persists', async ({ page }) => {
    await signInAsTestOwner(page)
    await page.goto('/dashboard/settings/ordering')

    await page.locator('[data-testid="ordering-prep-time"]').selectOption('45')
    await page.locator('[data-testid="ordering-min-order"]').fill('12.50')
    await page.locator('[data-testid="ordering-item-notes"]').uncheck()

    await expect(page.locator('[data-testid="ordering-save"]')).toBeEnabled()
    await page.locator('[data-testid="ordering-save"]').click()
    await expect(page.locator('[data-testid="ordering-saved-toast"]')).toBeVisible()

    await page.reload()
    await expect(page.locator('[data-testid="ordering-prep-time"]')).toHaveValue('45')
    await expect(page.locator('[data-testid="ordering-min-order"]')).toHaveValue('12.50')
    await expect(page.locator('[data-testid="ordering-item-notes"]')).not.toBeChecked()

    const row = await getOrderingConfig()
    expect(row.takeaway_prep_time_minutes).toBe(45)
    expect(row.takeaway_min_order_cents).toBe(1250)
    expect(row.takeaway_item_notes_allowed).toBe(false)
  })

  test('T3: toggling accepting-orders off shows the closed state on the consumer takeaway page', async ({ page }) => {
    await signInAsTestOwner(page)
    await page.goto('/dashboard/settings/ordering')

    await page.locator('[data-testid="ordering-accepting-orders"]').uncheck()
    await page.locator('[data-testid="ordering-save"]').click()
    await expect(page.locator('[data-testid="ordering-saved-toast"]')).toBeVisible()

    await page.goto(`/r/${TEST_RESTAURANT_SLUG}/order`)
    await expect(page.getByText('Afhalen is vandaag tijdelijk gepauzeerd. Kijk snel terug.')).toBeVisible()
  })

  test('T4: validation errors (direct route POST)', async ({ page }) => {
    await signInAsTestOwner(page)

    const base = {
      takeaway_prep_time_minutes: 20,
      takeaway_min_order_cents: 0,
      takeaway_slot_interval_minutes: 15,
      takeaway_accepting_orders: true,
      takeaway_item_notes_allowed: true,
      takeaway_scheduled_orders_allowed: false,
    }

    let res = await page.request.post('/api/dashboard/settings/ordering', {
      data: { ...base, takeaway_min_order_cents: -100 },
    })
    expect(res.status()).toBe(400)
    expect((await res.json()).code).toBe('min_order_negative')

    res = await page.request.post('/api/dashboard/settings/ordering', {
      data: { ...base, takeaway_prep_time_minutes: 12 },
    })
    expect(res.status()).toBe(400)
    expect((await res.json()).code).toBe('prep_time_invalid')

    res = await page.request.post('/api/dashboard/settings/ordering', {
      data: { ...base, takeaway_slot_interval_minutes: 25 },
    })
    expect(res.status()).toBe(400)
    expect((await res.json()).code).toBe('slot_interval_invalid')
  })

  test('T5: service_takeaway_enabled=false renders the informational card, no editable controls', async ({ page }) => {
    await setServiceTakeawayEnabled(false)
    try {
      await signInAsTestOwner(page)
      await page.goto('/dashboard/settings/ordering')

      await expect(page.locator('[data-testid="ordering-disabled-card"]')).toBeVisible()
      await expect(page.locator('[data-testid="ordering-accepting-orders"]')).toHaveCount(0)
      await expect(page.locator('[data-testid="ordering-config-section"]')).toHaveCount(0)
      await expect(page.locator('[data-testid="ordering-save"]')).toHaveCount(0)
    } finally {
      await setServiceTakeawayEnabled(true)
    }
  })

  test('T6: server blocks a save when service_takeaway_enabled=false', async ({ page }) => {
    await setServiceTakeawayEnabled(false)
    try {
      await signInAsTestOwner(page)
      const res = await page.request.post('/api/dashboard/settings/ordering', {
        data: {
          takeaway_prep_time_minutes: 20,
          takeaway_min_order_cents: 0,
          takeaway_slot_interval_minutes: 15,
          takeaway_accepting_orders: true,
          takeaway_item_notes_allowed: true,
          takeaway_scheduled_orders_allowed: false,
        },
      })
      expect(res.status()).toBe(409)
      expect((await res.json()).code).toBe('takeaway_not_enabled')
    } finally {
      await setServiceTakeawayEnabled(true)
    }
  })

  test.skip('T7: rate limit fires (unreachable in dev-mode e2e — see D5.1/D5.2/D5.3 rationale)', async () => {})

  test('T8: cross-restaurant safety', async ({ page }) => {
    const { data: before } = await adminClient()
      .from('restaurants')
      .select(
        'takeaway_prep_time_minutes, takeaway_min_order_cents, takeaway_slot_interval_minutes, takeaway_accepting_orders, takeaway_item_notes_allowed, takeaway_scheduled_orders_allowed',
      )
      .eq('id', OTHER_RESTAURANT_ID)
      .single()

    await signInAsTestOwner(page)
    await page.goto('/dashboard/settings/ordering')
    await page.locator('[data-testid="ordering-prep-time"]').selectOption('60')
    await page.locator('[data-testid="ordering-save"]').click()
    await expect(page.locator('[data-testid="ordering-saved-toast"]')).toBeVisible()

    const { data: after } = await adminClient()
      .from('restaurants')
      .select(
        'takeaway_prep_time_minutes, takeaway_min_order_cents, takeaway_slot_interval_minutes, takeaway_accepting_orders, takeaway_item_notes_allowed, takeaway_scheduled_orders_allowed',
      )
      .eq('id', OTHER_RESTAURANT_ID)
      .single()
    expect(after).toEqual(before)
  })

  test('T9: audit row carries fields_changed only', async ({ page }) => {
    await signInAsTestOwner(page)
    await page.goto('/dashboard/settings/ordering')

    await page.locator('[data-testid="ordering-prep-time"]').selectOption('30')
    await page.locator('[data-testid="ordering-scheduled-orders"]').check()
    await page.locator('[data-testid="ordering-save"]').click()
    await expect(page.locator('[data-testid="ordering-saved-toast"]')).toBeVisible()

    const { data: rows } = await adminClient()
      .from('dashboard_audit_logs')
      .select('*')
      .eq('restaurant_id', TEST_RESTAURANT_ID)
      .eq('event_type', 'settings.ordering.edit')
      .order('created_at', { ascending: false })
      .limit(1)

    const audit = rows?.[0]
    expect(audit).toBeTruthy()
    const fieldsChanged = audit.event_data.fields_changed as string[]
    expect(fieldsChanged).toContain('takeaway_prep_time_minutes')
    expect(fieldsChanged).toContain('takeaway_scheduled_orders_allowed')
  })
})
