import { test, expect } from '../fixtures/base'
import { wipeTestRestaurant, TEST_RESTAURANT_ID, adminClient } from '../fixtures/test-restaurant'
import { signInAsTestOwner } from '../fixtures/dashboard-auth'
import { seedTab, cleanupSeededTabGuests, createSecondaryTestTable, deleteSecondaryTestTable } from '../fixtures/seed-tabs'

async function getTab(tabId: string) {
  const supabase = adminClient()
  const { data } = await supabase.from('tabs').select('*').eq('id', tabId).maybeSingle()
  return data
}

async function getOrder(orderId: string) {
  const supabase = adminClient()
  const { data } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle()
  return data
}

async function getDashboardAuditRows(tabId: string, eventType: string) {
  const supabase = adminClient()
  const { data } = await supabase
    .from('dashboard_audit_logs')
    .select('*')
    .eq('tab_id', tabId)
    .eq('event_type', eventType)
  return data ?? []
}

test.describe('Tabs page + close flow (D3.4)', () => {
  test('empty state', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()

    try {
      await signInAsTestOwner(page)
      await page.goto('/dashboard/tabs')

      await expect(page.getByText('0', { exact: true }).first()).toBeVisible()
      await expect(page.locator('[data-testid^="tab-card-"]')).toHaveCount(0)
    } finally {
      await wipeTestRestaurant()
    }
  })

  test('open tab + orders visible', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()

    const seeded = await seedTab({
      restaurantId: TEST_RESTAURANT_ID,
      openedMinutesAgo: 30,
      orders: [
        { orderType: 'qr', status: 'served', totalCents: 3000 },
        { orderType: 'takeaway', status: 'served', totalCents: 3000, guestName: 'Guest A' },
        { orderType: 'takeaway', status: 'completed', totalCents: 2750, guestName: 'Guest B' },
      ],
    })

    try {
      await signInAsTestOwner(page)
      await page.goto('/dashboard/tabs')

      const card = page.locator(`[data-testid="tab-card-${seeded.tabId}"]`)
      await expect(card).toBeVisible()
      await expect(card.getByText('87,50', { exact: false })).toBeVisible()
      await expect(card.getByText('3 bestellingen', { exact: false })).toBeVisible()
      await expect(card.getByText('2 gasten', { exact: false })).toBeVisible()
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededTabGuests(seeded.guestIds)
    }
  })

  test('stale filter', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()

    // tabs_table_open_unique allows only one open tab per table, and the
    // fixture restaurant has a single table — a second throwaway table is
    // provisioned so both tabs can be open concurrently.
    const secondTable = await createSecondaryTestTable()

    const fresh = await seedTab({
      restaurantId: TEST_RESTAURANT_ID,
      openedMinutesAgo: 30,
      orders: [{ orderType: 'qr', status: 'served', totalCents: 1500 }],
    })
    const stale = await seedTab({
      restaurantId: TEST_RESTAURANT_ID,
      tableId: secondTable.tableId,
      openedMinutesAgo: 300,
      orders: [{ orderType: 'qr', status: 'served', totalCents: 1200 }],
    })

    try {
      await signInAsTestOwner(page)
      await page.goto('/dashboard/tabs')

      await expect(page.locator(`[data-testid="tab-card-${fresh.tabId}"]`)).toBeVisible()
      await expect(page.locator(`[data-testid="tab-card-${stale.tabId}"]`)).toBeVisible()

      await page.locator('[data-testid="tabs-filter-stale"]').click()
      await expect(page).toHaveURL(/filter=stale/)

      await expect(page.locator(`[data-testid="tab-card-${stale.tabId}"]`)).toBeVisible()
      await expect(page.locator(`[data-testid="tab-card-${fresh.tabId}"]`)).toHaveCount(0)
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededTabGuests([...fresh.guestIds, ...stale.guestIds])
      await deleteSecondaryTestTable(secondTable.tableId)
    }
  })

  test('paid-at-table close cascades order statuses', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()

    const seeded = await seedTab({
      restaurantId: TEST_RESTAURANT_ID,
      orders: [
        { orderType: 'qr', status: 'served', totalCents: 1000, paymentStatus: 'open_tab' },
        { orderType: 'qr', status: 'served', totalCents: 1000, paymentStatus: 'open_tab' },
        { orderType: 'qr', status: 'served', totalCents: 1000, paymentStatus: 'open_tab' },
      ],
    })

    try {
      await signInAsTestOwner(page)
      await page.goto(`/dashboard/tabs?tab=${seeded.tabId}`)

      await page.locator('[data-testid="tab-detail-settle"]:visible').click()
      await expect(page.getByRole('alertdialog')).toBeVisible()
      await page.getByRole('alertdialog').getByRole('button', { name: 'Ja, afgerekend' }).click()
      await expect(page.getByRole('alertdialog')).toHaveCount(0, { timeout: 10_000 })

      await expect(async () => {
        const tab = await getTab(seeded.tabId)
        expect(tab?.status).toBe('settled')
      }).toPass({ timeout: 10_000 })

      const tab = await getTab(seeded.tabId)
      expect(tab?.settlement).toBe('paid_at_table')
      expect(tab?.closed_by).toBeTruthy()
      expect(tab?.closed_at).toBeTruthy()

      for (const orderId of seeded.orderIds) {
        const order = await getOrder(orderId)
        expect(order?.status).toBe('completed')
        expect(order?.payment_status).toBe('open_tab')
      }

      const auditRows = await getDashboardAuditRows(seeded.tabId, 'tab.closed')
      expect(auditRows.length).toBe(1)
      expect(auditRows[0].event_data.settlement).toBe('paid_at_table')
      expect(auditRows[0].event_data.cascade_order_ids.sort()).toEqual([...seeded.orderIds].sort())
      expect(auditRows[0].event_data.cascade_skipped).toEqual([])

      await page.goto('/dashboard/tabs')
      await expect(page.locator(`[data-testid="tab-card-${seeded.tabId}"]`)).toHaveCount(0)
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededTabGuests(seeded.guestIds)
    }
  })

  test('write-off preserves order statuses and payment_status', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()

    const seeded = await seedTab({
      restaurantId: TEST_RESTAURANT_ID,
      openedMinutesAgo: 300,
      orders: [
        { orderType: 'qr', status: 'served', totalCents: 1500, paymentStatus: 'open_tab' },
        { orderType: 'qr', status: 'served', totalCents: 1500, paymentStatus: 'open_tab' },
      ],
    })

    try {
      await signInAsTestOwner(page)
      await page.goto(`/dashboard/tabs?tab=${seeded.tabId}`)

      await page.locator('[data-testid="tab-detail-writeoff"]:visible').click()
      const dialog = page.getByRole('alertdialog')
      await expect(dialog).toBeVisible()

      const confirmButton = dialog.getByRole('button', { name: 'Ja, afschrijven' })
      await expect(confirmButton).toBeDisabled()

      await page.locator('#write-off-reason').fill('Guest walked out without paying.')
      await expect(confirmButton).toBeEnabled()
      await confirmButton.click()
      await expect(dialog).toHaveCount(0, { timeout: 10_000 })

      await expect(async () => {
        const tab = await getTab(seeded.tabId)
        expect(tab?.status).toBe('cancelled')
      }).toPass({ timeout: 10_000 })

      const tab = await getTab(seeded.tabId)
      expect(tab?.settlement).toBe('written_off')
      expect(tab?.write_off_reason).toBe('Guest walked out without paying.')
      expect(tab?.closed_by).toBeTruthy()

      for (const orderId of seeded.orderIds) {
        const order = await getOrder(orderId)
        expect(order?.status).toBe('served')
        expect(order?.payment_status).toBe('open_tab')
      }

      const auditRows = await getDashboardAuditRows(seeded.tabId, 'tab.closed')
      expect(auditRows.length).toBe(1)
      expect(auditRows[0].event_data.settlement).toBe('written_off')
      expect(auditRows[0].event_data.reason).toBe('Guest walked out without paying.')
      expect(auditRows[0].event_data.cascade_order_ids).toEqual([])
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededTabGuests(seeded.guestIds)
    }
  })

  test('closed tab detail shows banner, no action buttons', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()

    const seeded = await seedTab({
      restaurantId: TEST_RESTAURANT_ID,
      status: 'settled',
      settlement: 'paid_at_table',
      useOwnerAsCloser: true,
      closedMinutesAgo: 5,
      orders: [{ orderType: 'qr', status: 'completed', totalCents: 2000, paymentStatus: 'open_tab' }],
    })

    try {
      await signInAsTestOwner(page)
      await page.goto(`/dashboard/tabs?tab=${seeded.tabId}`)

      await expect(page.getByText('afgerekend op', { exact: false }).first()).toBeVisible()
      await expect(page.locator('[data-testid="tab-detail-settle"]')).toHaveCount(0)
      await expect(page.locator('[data-testid="tab-detail-writeoff"]')).toHaveCount(0)
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededTabGuests(seeded.guestIds)
    }
  })

  test('monotonic double-close', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()

    const seeded = await seedTab({
      restaurantId: TEST_RESTAURANT_ID,
      orders: [{ orderType: 'qr', status: 'served', totalCents: 1000 }],
    })

    try {
      await signInAsTestOwner(page)

      const [res1, res2] = await Promise.all([
        page.request.post(`/api/dashboard/tabs/${seeded.tabId}/close`, { data: { settlement: 'paid_at_table' } }),
        page.request.post(`/api/dashboard/tabs/${seeded.tabId}/close`, { data: { settlement: 'paid_at_table' } }),
      ])
      const statuses = [res1.status(), res2.status()].sort()
      expect(statuses).toEqual([200, 409])

      const failed = res1.status() === 409 ? res1 : res2
      expect((await failed.json()).error).toBe('already_closed')

      expect((await getDashboardAuditRows(seeded.tabId, 'tab.closed')).length).toBe(1)
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededTabGuests(seeded.guestIds)
    }
  })

  test('write-off requires reason', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()

    const seeded = await seedTab({
      restaurantId: TEST_RESTAURANT_ID,
      orders: [{ orderType: 'qr', status: 'served', totalCents: 1000 }],
    })

    try {
      await signInAsTestOwner(page)

      const res = await page.request.post(`/api/dashboard/tabs/${seeded.tabId}/close`, {
        data: { settlement: 'written_off' },
      })
      expect(res.status()).toBe(400)
      expect((await res.json()).error).toBe('reason_required')

      const tab = await getTab(seeded.tabId)
      expect(tab?.status).toBe('open')
      expect((await getDashboardAuditRows(seeded.tabId, 'tab.closed')).length).toBe(0)
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededTabGuests(seeded.guestIds)
    }
  })

  test('D1.2 alert deep-link opens the stale-filtered view', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()

    const seeded = await seedTab({
      restaurantId: TEST_RESTAURANT_ID,
      openedMinutesAgo: 300,
      orders: [{ orderType: 'qr', status: 'served', totalCents: 1500 }],
    })

    try {
      await signInAsTestOwner(page)
      await page.goto('/dashboard/tabs?filter=stale')

      await expect(page.locator('[data-testid="tabs-filter-stale"]')).toHaveClass(/bg-amber/)
      await expect(page.locator(`[data-testid="tab-card-${seeded.tabId}"]`)).toBeVisible()
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededTabGuests(seeded.guestIds)
    }
  })
})
