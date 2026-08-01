import { test, expect } from '../fixtures/base'
import { wipeTestRestaurant, TEST_RESTAURANT_ID, adminClient } from '../fixtures/test-restaurant'
import { signInAsTestOwner } from '../fixtures/dashboard-auth'
import { seedOrders, cleanupSeededOrderGuests } from '../fixtures/seed-orders'

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

test.describe('Order cancel + refund actions (D3.3)', () => {
  test('cancel unpaid pending order', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()

    const seeded = await seedOrders({
      restaurantId: TEST_RESTAURANT_ID,
      orders: [{ orderType: 'qr', status: 'pending', totalCents: 1500, paymentStatus: 'pending' }],
    })
    const orderId = seeded.orderIds[0]

    try {
      await signInAsTestOwner(page)
      await page.goto(`/dashboard/orders?order=${orderId}`)

      const cancelButton = page.locator('[data-testid="detail-order-cancel"]:visible')
      await expect(cancelButton).toBeVisible()
      await expect(page.locator('[data-testid="detail-order-refund"]:visible')).toHaveCount(0)

      await cancelButton.click()
      await expect(page.getByRole('alertdialog')).toBeVisible()
      await expect(page.getByRole('alertdialog').getByText('€', { exact: false })).toHaveCount(0)

      await page.locator('#cancel-order-reason').fill('Guest changed mind.')
      await page.getByRole('alertdialog').getByRole('button', { name: 'Ja, annuleer' }).click()

      await expect(page.getByRole('alertdialog')).toHaveCount(0, { timeout: 10_000 })
      await expect(async () => {
        expect((await getOrder(orderId))?.status).toBe('cancelled')
      }).toPass({ timeout: 10_000 })

      const order = await getOrder(orderId)
      expect(order?.cancelled_by_staff).toBeTruthy()

      const auditRows = await getDashboardAuditRows(orderId, 'order.cancelled')
      expect(auditRows.length).toBe(1)
      expect(auditRows[0].event_data.needs_refund).toBe(false)
      expect(auditRows[0].event_data.reason).toBe('Guest changed mind.')
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededOrderGuests(seeded.guestIds)
    }
  })

  test('cancel paid order records needs_refund in audit', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()

    const seeded = await seedOrders({
      restaurantId: TEST_RESTAURANT_ID,
      orders: [
        {
          orderType: 'takeaway',
          status: 'preparing',
          totalCents: 2450,
          paymentStatus: 'paid',
          guestName: 'Paid Cancel Guest',
        },
      ],
    })
    const orderId = seeded.orderIds[0]

    try {
      await signInAsTestOwner(page)
      await page.goto(`/dashboard/orders?order=${orderId}`)

      await page.locator('[data-testid="detail-order-cancel"]:visible').click()
      await expect(page.getByRole('alertdialog')).toBeVisible()
      await expect(page.getByRole('alertdialog').getByText('24,50', { exact: false })).toBeVisible()

      await page.getByRole('alertdialog').getByRole('button', { name: 'Ja, annuleer' }).click()
      await expect(page.getByRole('alertdialog')).toHaveCount(0, { timeout: 10_000 })

      await expect(async () => {
        const order = await getOrder(orderId)
        expect(order?.status).toBe('cancelled')
        expect(order?.payment_status).toBe('paid')
      }).toPass({ timeout: 10_000 })

      const auditRows = await getDashboardAuditRows(orderId, 'order.cancelled')
      expect(auditRows.length).toBe(1)
      expect(auditRows[0].event_data.needs_refund).toBe(true)
      expect(auditRows[0].event_data.paid_amount_cents).toBe(2450)
      expect(auditRows[0].event_data.payment_status_before).toBe('paid')
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededOrderGuests(seeded.guestIds)
    }
  })

  test('cancel open-tab order does not flag needs_refund', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()

    const seeded = await seedOrders({
      restaurantId: TEST_RESTAURANT_ID,
      orders: [{ orderType: 'qr', status: 'preparing', totalCents: 1800, paymentStatus: 'open_tab' }],
    })
    const orderId = seeded.orderIds[0]

    try {
      await signInAsTestOwner(page)
      await page.goto(`/dashboard/orders?order=${orderId}`)

      await page.locator('[data-testid="detail-order-cancel"]:visible').click()
      await expect(page.getByRole('alertdialog')).toBeVisible()
      await expect(page.getByRole('alertdialog').getByText('openstaande rekening')).toBeVisible()

      await page.getByRole('alertdialog').getByRole('button', { name: 'Ja, annuleer' }).click()
      await expect(page.getByRole('alertdialog')).toHaveCount(0, { timeout: 10_000 })

      await expect(async () => {
        expect((await getOrder(orderId))?.status).toBe('cancelled')
      }).toPass({ timeout: 10_000 })

      const auditRows = await getDashboardAuditRows(orderId, 'order.cancelled')
      expect(auditRows.length).toBe(1)
      expect(auditRows[0].event_data.needs_refund).toBe(false)
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededOrderGuests(seeded.guestIds)
    }
  })

  test('cannot cancel a served order — must use refund path', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()

    const seeded = await seedOrders({
      restaurantId: TEST_RESTAURANT_ID,
      orders: [{ orderType: 'qr', status: 'served', totalCents: 1200, paymentStatus: 'open_tab' }],
    })
    const orderId = seeded.orderIds[0]

    try {
      await signInAsTestOwner(page)
      await page.goto(`/dashboard/orders?order=${orderId}`)

      await expect(page.locator('[data-testid="detail-order-cancel"]:visible')).toHaveCount(0)
      await expect(page.locator('[data-testid="detail-order-refund"]:visible')).toHaveCount(0)

      const res = await page.request.post(`/api/dashboard/orders/${orderId}/cancel`, { data: {} })
      expect(res.status()).toBe(409)
      expect((await res.json()).error).toBe('use_refund')

      expect((await getOrder(orderId))?.status).toBe('served')
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededOrderGuests(seeded.guestIds)
    }
  })

  test('refund completed paid order', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()

    const seeded = await seedOrders({
      restaurantId: TEST_RESTAURANT_ID,
      orders: [
        {
          orderType: 'takeaway',
          status: 'completed',
          totalCents: 1800,
          paymentStatus: 'paid',
          guestName: 'Refund Guest',
        },
      ],
    })
    const orderId = seeded.orderIds[0]

    try {
      await signInAsTestOwner(page)
      await page.goto(`/dashboard/orders?order=${orderId}`)

      await expect(page.locator('[data-testid="detail-order-cancel"]:visible')).toHaveCount(0)
      const refundButton = page.locator('[data-testid="detail-order-refund"]:visible')
      await expect(refundButton).toBeVisible()

      await refundButton.click()
      await expect(page.getByRole('alertdialog')).toBeVisible()
      await expect(page.getByRole('alertdialog').getByText('18,00', { exact: false })).toBeVisible()

      await page.locator('#refund-order-reason').fill('Guest complaint about temperature.')
      await page.getByRole('alertdialog').getByRole('button', { name: 'Ja, betaal terug' }).click()

      await expect(page.getByRole('alertdialog')).toHaveCount(0, { timeout: 10_000 })

      await expect(async () => {
        const order = await getOrder(orderId)
        expect(order?.status).toBe('refunded')
        expect(order?.payment_status).toBe('paid')
      }).toPass({ timeout: 10_000 })

      const auditRows = await getDashboardAuditRows(orderId, 'order.refunded')
      expect(auditRows.length).toBe(1)
      expect(auditRows[0].event_data.refund_amount_cents).toBe(1800)
      expect(auditRows[0].event_data.reason).toBe('Guest complaint about temperature.')
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededOrderGuests(seeded.guestIds)
    }
  })

  test('cannot refund an unpaid completed order', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()

    const seeded = await seedOrders({
      restaurantId: TEST_RESTAURANT_ID,
      orders: [{ orderType: 'qr', status: 'completed', totalCents: 900, paymentStatus: 'pending' }],
    })
    const orderId = seeded.orderIds[0]

    try {
      await signInAsTestOwner(page)
      await page.goto(`/dashboard/orders?order=${orderId}`)

      await expect(page.locator('[data-testid="detail-order-refund"]:visible')).toHaveCount(0)

      const res = await page.request.post(`/api/dashboard/orders/${orderId}/refund`, { data: {} })
      expect(res.status()).toBe(409)
      expect((await res.json()).error).toBe('not_paid')

      expect((await getOrder(orderId))?.status).toBe('completed')
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededOrderGuests(seeded.guestIds)
    }
  })

  test('cannot refund a non-completed order', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()

    const seeded = await seedOrders({
      restaurantId: TEST_RESTAURANT_ID,
      orders: [{ orderType: 'qr', status: 'preparing', totalCents: 1500, paymentStatus: 'paid' }],
    })
    const orderId = seeded.orderIds[0]

    try {
      await signInAsTestOwner(page)
      await page.goto(`/dashboard/orders?order=${orderId}`)

      await expect(page.locator('[data-testid="detail-order-refund"]:visible')).toHaveCount(0)

      const res = await page.request.post(`/api/dashboard/orders/${orderId}/refund`, { data: {} })
      expect(res.status()).toBe(409)
      expect((await res.json()).error).toBe('not_completed')

      expect((await getOrder(orderId))?.status).toBe('preparing')
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededOrderGuests(seeded.guestIds)
    }
  })

  test('monotonic idempotency: two cancels in parallel', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()

    const seeded = await seedOrders({
      restaurantId: TEST_RESTAURANT_ID,
      orders: [{ orderType: 'qr', status: 'pending', totalCents: 1500, paymentStatus: 'pending' }],
    })
    const orderId = seeded.orderIds[0]

    try {
      await signInAsTestOwner(page)

      const [res1, res2] = await Promise.all([
        page.request.post(`/api/dashboard/orders/${orderId}/cancel`, { data: {} }),
        page.request.post(`/api/dashboard/orders/${orderId}/cancel`, { data: {} }),
      ])
      const statuses = [res1.status(), res2.status()].sort()
      expect(statuses).toEqual([200, 409])

      const failed = res1.status() === 409 ? res1 : res2
      expect((await failed.json()).error).toBe('already_advanced')

      expect((await getDashboardAuditRows(orderId, 'order.cancelled')).length).toBe(1)
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededOrderGuests(seeded.guestIds)
    }
  })
})
