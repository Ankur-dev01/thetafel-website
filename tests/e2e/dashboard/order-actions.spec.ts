import { test, expect } from '../fixtures/base'
import { wipeTestRestaurant, TEST_RESTAURANT_ID, adminClient } from '../fixtures/test-restaurant'
import { signInAsTestOwner } from '../fixtures/dashboard-auth'
import { seedOrders, cleanupSeededOrderGuests } from '../fixtures/seed-orders'
import { can } from '@/lib/dashboard/permissions'
import type { Locator } from '@playwright/test'

// The action button's own label and a status chip's label can be the
// literal same string (both "Klaar" — action.markReady vs status.ready), so
// waiting on visible text is ambiguous. `pending` (useOrderActions) covers
// the whole fetch+refresh round trip, so asserting disabled-then-enabled is
// a reliable "the UI has caught up with the new status" signal regardless of
// copy overlap — asserting disabled first closes the race where the button
// is still (or already) enabled at the exact instant `.click()` returns.
async function clickAndWaitForAdvance(button: Locator): Promise<void> {
  await button.click()
  await expect(button).toBeDisabled({ timeout: 3_000 })
  await expect(button).toBeEnabled({ timeout: 10_000 })
}

async function getOrder(orderId: string) {
  const supabase = adminClient()
  const { data } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle()
  return data
}

async function getDashboardAuditRows(orderId: string, eventType: string) {
  const supabase = adminClient()
  const { data } = await supabase
    .from('dashboard_audit_logs')
    .select('*')
    .eq('order_id', orderId)
    .eq('event_type', eventType)
  return data ?? []
}

async function getConsumerAuditRows(orderId: string, eventType: string) {
  const supabase = adminClient()
  const { data } = await supabase
    .from('consumer_audit_logs')
    .select('*')
    .eq('order_id', orderId)
    .eq('event_type', eventType)
  return data ?? []
}

test.describe('Order actions (D3.2)', () => {
  test('full happy path for a QR order', async ({ page }) => {
    test.setTimeout(90_000) // 4 sequential advance round trips — extra headroom under full-suite load
    await wipeTestRestaurant()

    const seeded = await seedOrders({
      restaurantId: TEST_RESTAURANT_ID,
      orders: [{ orderType: 'qr', status: 'pending', totalCents: 1500 }],
    })
    const orderId = seeded.orderIds[0]

    try {
      await signInAsTestOwner(page)
      await page.goto(`/dashboard/orders?order=${orderId}`)

      const nextAction = page.locator('[data-testid="detail-order-next-action"]:visible')

      await clickAndWaitForAdvance(nextAction)
      expect((await getOrder(orderId))?.status).toBe('confirmed')
      expect((await getDashboardAuditRows(orderId, 'order.confirmed')).length).toBe(1)

      await clickAndWaitForAdvance(nextAction)
      expect((await getOrder(orderId))?.status).toBe('preparing')
      expect((await getDashboardAuditRows(orderId, 'order.preparing')).length).toBe(1)

      await clickAndWaitForAdvance(nextAction)
      expect((await getOrder(orderId))?.status).toBe('ready')
      expect((await getDashboardAuditRows(orderId, 'order.ready')).length).toBe(1)
      // QR: no email ever sent for this order.
      expect((await getConsumerAuditRows(orderId, 'email.sent')).length).toBe(0)

      await nextAction.click()
      await expect(page.locator('[data-testid="detail-order-next-action"]:visible')).toHaveCount(0, { timeout: 10_000 })
      expect((await getOrder(orderId))?.status).toBe('served')
      expect((await getDashboardAuditRows(orderId, 'order.served')).length).toBe(1)
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededOrderGuests(seeded.guestIds)
    }
  })

  test('full happy path for a takeaway order + ready email fires', async ({ page }) => {
    test.setTimeout(90_000) // 4 sequential advance round trips — extra headroom under full-suite load
    await wipeTestRestaurant()

    const seeded = await seedOrders({
      restaurantId: TEST_RESTAURANT_ID,
      orders: [{ orderType: 'takeaway', status: 'pending', totalCents: 2000, guestName: 'Ready Email Guest' }],
    })
    const orderId = seeded.orderIds[0]

    try {
      await signInAsTestOwner(page)
      await page.goto(`/dashboard/orders?order=${orderId}`)

      const nextAction = page.locator('[data-testid="detail-order-next-action"]:visible')

      await clickAndWaitForAdvance(nextAction) // confirmed
      await clickAndWaitForAdvance(nextAction) // preparing
      await clickAndWaitForAdvance(nextAction) // ready
      expect((await getOrder(orderId))?.status).toBe('ready')

      // ready_notified_at set + email.sent audit row, within a few seconds
      // (the email dispatch is fire-and-forget, not awaited by the route).
      await expect(async () => {
        const order = await getOrder(orderId)
        expect(order?.ready_notified_at).toBeTruthy()
        const sent = await getConsumerAuditRows(orderId, 'email.sent')
        expect(sent.length).toBe(1)
        expect(sent[0].event_data.templateKey).toBe('takeaway.ready_for_pickup')
      }).toPass({ timeout: 10000 })

      await nextAction.click() // completed (Picked up)
      await expect(page.locator('[data-testid="detail-order-next-action"]:visible')).toHaveCount(0, { timeout: 10_000 })
      expect((await getOrder(orderId))?.status).toBe('completed')
      expect((await getDashboardAuditRows(orderId, 'order.completed')).length).toBe(1)
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededOrderGuests(seeded.guestIds)
    }
  })

  test('email skipped when no guest email', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()

    const seeded = await seedOrders({
      restaurantId: TEST_RESTAURANT_ID,
      orders: [
        {
          orderType: 'takeaway',
          status: 'preparing',
          totalCents: 1200,
          guestName: 'No Email Guest',
          guestEmail: null,
        },
      ],
    })
    const orderId = seeded.orderIds[0]

    try {
      await signInAsTestOwner(page)
      await page.goto(`/dashboard/orders?order=${orderId}`)

      await page.locator('[data-testid="detail-order-next-action"]:visible').click() // -> ready
      await expect(page.getByText('Klaar', { exact: true }).first()).toBeVisible({ timeout: 10_000 })

      await expect(async () => {
        const skipped = await getConsumerAuditRows(orderId, 'email.skipped')
        expect(skipped.length).toBe(1)
      }).toPass({ timeout: 10000 })

      // Nothing actually fired, so there's nothing to guard against
      // re-firing later — ready_notified_at stays null (see the standing
      // comment in dispatchTakeawayReady.ts / the D3.2 advance route).
      const order = await getOrder(orderId)
      expect(order?.ready_notified_at).toBeNull()
      expect((await getConsumerAuditRows(orderId, 'email.sent')).length).toBe(0)
      expect((await getConsumerAuditRows(orderId, 'email.send_failed')).length).toBe(0)
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededOrderGuests(seeded.guestIds)
    }
  })

  test('illegal transition rejected', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()

    const seeded = await seedOrders({
      restaurantId: TEST_RESTAURANT_ID,
      orders: [{ orderType: 'qr', status: 'pending', totalCents: 1500 }],
    })
    const orderId = seeded.orderIds[0]

    try {
      await signInAsTestOwner(page)
      const res = await page.request.post(`/api/dashboard/orders/${orderId}/advance`, {
        data: { to: 'ready' },
      })
      expect(res.status()).toBe(409)
      expect((await res.json()).error).toBe('illegal_transition')

      expect((await getOrder(orderId))?.status).toBe('pending')
      expect((await getDashboardAuditRows(orderId, 'order.ready')).length).toBe(0)
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededOrderGuests(seeded.guestIds)
    }
  })

  test('cancel/refund routed to other endpoint', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()

    const seeded = await seedOrders({
      restaurantId: TEST_RESTAURANT_ID,
      orders: [{ orderType: 'qr', status: 'confirmed', totalCents: 1500 }],
    })
    const orderId = seeded.orderIds[0]

    try {
      await signInAsTestOwner(page)
      const res = await page.request.post(`/api/dashboard/orders/${orderId}/advance`, {
        data: { to: 'cancelled' },
      })
      expect(res.status()).toBe(400)
      expect((await res.json()).error).toBe('use_cancel_endpoint')

      expect((await getOrder(orderId))?.status).toBe('confirmed')
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededOrderGuests(seeded.guestIds)
    }
  })

  test('monotonic idempotency: two accepts in parallel', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()

    const seeded = await seedOrders({
      restaurantId: TEST_RESTAURANT_ID,
      orders: [{ orderType: 'qr', status: 'pending', totalCents: 1500 }],
    })
    const orderId = seeded.orderIds[0]

    try {
      await signInAsTestOwner(page)

      const [res1, res2] = await Promise.all([
        page.request.post(`/api/dashboard/orders/${orderId}/advance`, { data: { to: 'confirmed' } }),
        page.request.post(`/api/dashboard/orders/${orderId}/advance`, { data: { to: 'confirmed' } }),
      ])
      const statuses = [res1.status(), res2.status()].sort()
      expect(statuses).toEqual([200, 409])

      expect((await getDashboardAuditRows(orderId, 'order.confirmed')).length).toBe(1)
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededOrderGuests(seeded.guestIds)
    }
  })

  test('chime does NOT re-ring on a status change', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()

    const seeded = await seedOrders({
      restaurantId: TEST_RESTAURANT_ID,
      orders: [{ orderType: 'qr', status: 'pending', totalCents: 1500 }],
    })
    const orderId = seeded.orderIds[0]

    try {
      await signInAsTestOwner(page)
      await page.addInitScript(() => {
        ;(window as unknown as { __chimeCount: number }).__chimeCount = 0
        window.addEventListener('tafel:chime-played', () => {
          ;(window as unknown as { __chimeCount: number }).__chimeCount += 1
        })
      })
      await page.goto(`/dashboard/orders?order=${orderId}&pollMs=1500`)

      await page.locator('[data-testid="chime-toggle"]').click()

      // Let at least one poll cycle pass with the enabling test-chime counted.
      await page.waitForTimeout(2000)
      const countAfterEnable = await page.evaluate(
        () => (window as unknown as { __chimeCount: number }).__chimeCount,
      )
      expect(countAfterEnable).toBe(1) // the enabling click's own test-chime

      await page.locator('[data-testid="detail-order-next-action"]:visible').click()
      await expect(page.getByText('Bevestigd', { exact: true }).first()).toBeVisible({ timeout: 10_000 })

      // Give a couple more poll cycles a chance to (wrongly) ring.
      await page.waitForTimeout(3500)
      const countAfterAdvance = await page.evaluate(
        () => (window as unknown as { __chimeCount: number }).__chimeCount,
      )
      expect(countAfterAdvance).toBe(1) // unchanged — status transitions don't touch created_at
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededOrderGuests(seeded.guestIds)
    }
  })

  test('permission gate exists (owner-passthrough stub documented)', async () => {
    // D0.4's permission map is a stub: owner passes everything, every other
    // role is denied, until D8.2 builds the real per-role matrix. There's no
    // non-owner staff fixture in the e2e lifecycle to drive a real 403
    // through the UI/API without standing up a second staff account, so this
    // documents the gate at the unit level instead: assertDashboardWriteAllowed
    // (called by the advance route with 'order.status.advance') delegates to
    // this same `can()` function.
    expect(can('owner', 'order.status.advance')).toBe(true)
    expect(can('manager', 'order.status.advance')).toBe(false)
    expect(can('kitchen', 'order.status.advance')).toBe(false)
  })

  // Cross-restaurant isolation (Test 9 in the unit spec) is not automated
  // here: it would require a second, synthetic restaurant for the test's
  // lifetime, and the e2e suite is only permitted to write to
  // TEST_RESTAURANT_ID (see fixtures/test-restaurant.ts) — same call made for
  // D2.4's walk-in cross-restaurant test. The guarantee is structural: the
  // advance route's order lookup filters `.eq('restaurant_id', restaurant.id)`
  // explicitly (belt), on top of RLS scoping the SELECT to the caller's own
  // restaurant (braces) — an order belonging to a different restaurant simply
  // isn't in the result set, by construction of the query.
})
