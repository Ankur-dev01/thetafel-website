import { test, expect } from '../fixtures/base'
import { wipeTestRestaurant, TEST_RESTAURANT_ID } from '../fixtures/test-restaurant'
import { signInAsTestOwner } from '../fixtures/dashboard-auth'
import { seedOrders, seedNewOrder, cleanupSeededOrderGuests } from '../fixtures/seed-orders'

test.describe('Bestellingen list (D3.1)', () => {
  test('empty state', async ({ page }) => {
    await wipeTestRestaurant()
    await signInAsTestOwner(page)

    await page.goto('/dashboard/orders')

    await expect(page.getByText('Geen actieve bestellingen')).toBeVisible()
    const disclosure = page.locator('summary', { hasText: 'Voltooid' })
    await expect(disclosure).toContainText('Voltooid (0)')
    await expect(page.locator('details[open] summary', { hasText: 'Voltooid' })).toHaveCount(0)

    await wipeTestRestaurant()
  })

  test('active + completed grouping', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()

    const seeded = await seedOrders({
      restaurantId: TEST_RESTAURANT_ID,
      orders: [
        { orderType: 'qr', status: 'pending', totalCents: 1500, minutesAgoCreated: 10 },
        { orderType: 'qr', status: 'preparing', totalCents: 2200, minutesAgoCreated: 5 },
        { orderType: 'takeaway', status: 'ready', totalCents: 1800, minutesAgoCreated: 2, pickupMinutesFromNow: 5 },
        { orderType: 'qr', status: 'completed', totalCents: 1000, minutesAgoCreated: 180 },
        { orderType: 'takeaway', status: 'cancelled', totalCents: 900, minutesAgoCreated: 120, pickupMinutesFromNow: 30 },
      ],
    })

    try {
      await signInAsTestOwner(page)
      await page.goto('/dashboard/orders')

      const activeCards = page.locator('[data-testid^="order-card-"]:visible')
      await expect(activeCards).toHaveCount(3)

      // FIFO: oldest first.
      const refs = await activeCards.evaluateAll((els) => els.map((el) => el.textContent))
      expect(refs[0]).toContain('QR-') // order A (pending, 10 min ago)

      const summary = page.locator('summary', { hasText: 'Voltooid' })
      await expect(summary).toContainText('Voltooid (2)')

      await summary.click()
      // Wipe active cards from the count check now — completed cards join the DOM.
      await expect(page.locator('[data-testid^="order-card-"]:visible')).toHaveCount(5)

      await expect(page.getByText('QR', { exact: true }).first()).toBeVisible()
      await expect(page.getByText('Afhaal', { exact: true }).first()).toBeVisible()
      await expect(page.getByText('gerechten').first()).toBeVisible()
      await expect(page.getByText('min geleden').first()).toBeVisible()
      await expect(page.getByText('Opgehaald', { exact: true })).toBeVisible()
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededOrderGuests(seeded.guestIds)
    }
  })

  test('filter chips', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()

    const seeded = await seedOrders({
      restaurantId: TEST_RESTAURANT_ID,
      orders: [
        { orderType: 'qr', status: 'pending', totalCents: 1500, minutesAgoCreated: 10 },
        { orderType: 'qr', status: 'preparing', totalCents: 2200, minutesAgoCreated: 5 },
        { orderType: 'takeaway', status: 'ready', totalCents: 1800, minutesAgoCreated: 2, pickupMinutesFromNow: 5 },
      ],
    })

    try {
      await signInAsTestOwner(page)
      await page.goto('/dashboard/orders')

      await page.getByRole('button', { name: /^QR/ }).click()
      await expect(page).toHaveURL(/type=qr/)
      await expect(page.locator('[data-testid^="order-card-"]:visible')).toHaveCount(2)

      await page.getByRole('button', { name: /^Afhaal/ }).click()
      await expect(page).toHaveURL(/type=takeaway/)
      await expect(page.locator('[data-testid^="order-card-"]:visible')).toHaveCount(1)

      await page.getByRole('button', { name: /^Alle/ }).click()
      await expect(page.locator('[data-testid^="order-card-"]:visible')).toHaveCount(3)

      await page.getByRole('button', { name: /^Afhaal/ }).click()
      await expect(page).toHaveURL(/type=takeaway/) // wait for the push to commit before reloading
      await page.reload()
      await expect(page).toHaveURL(/type=takeaway/)
      await expect(page.locator('[data-testid^="order-card-"]:visible')).toHaveCount(1)
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededOrderGuests(seeded.guestIds)
    }
  })

  test('polling picks up a new order + chime rings', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()

    const seeded = await seedOrders({
      restaurantId: TEST_RESTAURANT_ID,
      orders: [{ orderType: 'qr', status: 'confirmed', totalCents: 1200 }],
    })

    try {
      await signInAsTestOwner(page)
      await page.addInitScript(() => {
        window.addEventListener('tafel:chime-played', () => {
          ;(window as unknown as { __chimePlayed: boolean }).__chimePlayed = true
        })
      })
      await page.goto('/dashboard/orders?pollMs=1500')

      const toggle = page.locator('[data-testid="chime-toggle"]')
      await toggle.click()
      await expect(toggle).toHaveAttribute('aria-pressed', 'true')

      await expect(page.locator('[data-testid^="order-card-"]:visible')).toHaveCount(1)

      const newOrder = await seedNewOrder(TEST_RESTAURANT_ID)

      await expect(page.locator(`[data-testid="order-card-${newOrder.orderId}"]:visible`)).toBeVisible({
        timeout: 10_000,
      })

      const chimePlayed = await page.evaluate(() => (window as unknown as { __chimePlayed?: boolean }).__chimePlayed)
      expect(chimePlayed).toBe(true)
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededOrderGuests(seeded.guestIds)
    }
  })

  test('chime does NOT ring on initial load', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()

    const seeded = await seedOrders({
      restaurantId: TEST_RESTAURANT_ID,
      orders: [
        { orderType: 'qr', status: 'pending', totalCents: 1500 },
        { orderType: 'qr', status: 'confirmed', totalCents: 1800 },
      ],
    })

    try {
      await signInAsTestOwner(page)
      await page.addInitScript(() => {
        window.localStorage.setItem('tafel.dashboard.orders.chime', 'true')
        window.addEventListener('tafel:chime-played', () => {
          ;(window as unknown as { __chimePlayed: boolean }).__chimePlayed = true
        })
      })
      await page.goto('/dashboard/orders')
      await expect(page.locator('[data-testid^="order-card-"]:visible')).toHaveCount(2)

      await page.waitForTimeout(3000)
      const chimePlayed = await page.evaluate(() => (window as unknown as { __chimePlayed?: boolean }).__chimePlayed)
      expect(chimePlayed).toBeFalsy()
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededOrderGuests(seeded.guestIds)
    }
  })

  test('detail panel via ?order', async ({ page }) => {
    test.setTimeout(60_000)
    // Phone viewport: DetailSheet is the only variant with a close control —
    // DetailPanel (desktop) has none, matching the D2.1 bookings precedent
    // (BookingsClient wires onClose only to its DetailSheet, never its
    // DetailPanel) — so the close-button assertion below needs this viewport.
    await page.setViewportSize({ width: 375, height: 812 })
    await wipeTestRestaurant()

    const seeded = await seedOrders({
      restaurantId: TEST_RESTAURANT_ID,
      orders: [{ orderType: 'takeaway', status: 'confirmed', totalCents: 3000, itemCount: 3, guestName: 'Detail Guest' }],
    })

    try {
      await signInAsTestOwner(page)
      const orderId = seeded.orderIds[0]
      await page.goto(`/dashboard/orders?order=${orderId}`)

      const sheet = page.locator('[data-testid="order-detail-phone"]')
      await expect(sheet.getByText(/#PU-/).first()).toBeVisible()
      await expect(sheet.getByText('Detail Guest').first()).toBeVisible()
      await expect(sheet.locator('[data-testid="order-detail-item"]')).toHaveCount(3)
      await expect(sheet.getByText('Subtotaal').first()).toBeVisible()
      await expect(sheet.getByText('Totaal').first()).toBeVisible()
      await expect(sheet.getByText(/Aangemaakt/).first()).toBeVisible()

      const closeButton = sheet.locator('button[aria-label="Sluiten"]')
      await closeButton.click()
      await expect(page).not.toHaveURL(/order=/)

      await page.goto(`/dashboard/orders?order=${'00000000-0000-0000-0000-000000000000'}`)
      // Unknown order id: list still renders (the seeded order's own card),
      // no panel/sheet opens, no error.
      await expect(page.locator(`[data-testid="order-card-${orderId}"]:visible`)).toBeVisible()
      await expect(page.locator('[data-testid="order-detail-item"]')).toHaveCount(0)
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededOrderGuests(seeded.guestIds)
    }
  })

  test('phone tabs', async ({ page }) => {
    test.setTimeout(60_000)
    await page.setViewportSize({ width: 375, height: 812 })
    await wipeTestRestaurant()

    const seeded = await seedOrders({
      restaurantId: TEST_RESTAURANT_ID,
      orders: [
        { orderType: 'qr', status: 'pending', totalCents: 1500, minutesAgoCreated: 10 },
        { orderType: 'qr', status: 'completed', totalCents: 1000, minutesAgoCreated: 180 },
      ],
    })

    try {
      await signInAsTestOwner(page)
      await page.goto('/dashboard/orders')

      const activeTab = page.getByRole('button', { name: /^Actief/ })
      const completedTab = page.getByRole('button', { name: /^Voltooid/ })
      await expect(activeTab).toBeVisible()
      await expect(completedTab).toBeVisible()

      await expect(page.locator('[data-testid^="order-card-"]:visible')).toHaveCount(1)

      await completedTab.click()
      await expect(page).toHaveURL(/tab=completed/)
      await expect(page.locator('[data-testid^="order-card-"]:visible')).toHaveCount(1)

      await activeTab.click()
      await expect(page).not.toHaveURL(/tab=completed/)
      await expect(page.locator('[data-testid^="order-card-"]:visible')).toHaveCount(1)
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededOrderGuests(seeded.guestIds)
    }
  })
})
