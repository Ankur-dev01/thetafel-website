import { test, expect } from '../fixtures/base'
import { wipeTestRestaurant } from '../fixtures/test-restaurant'
import { signInAsTestOwner } from '../fixtures/dashboard-auth'
import {
  seedPaymentFailedToday,
  seedOrderReadyStale,
  seedTabOpenLong,
  seedBookingDepositPending,
  seedNotificationFailedToday,
  cleanupSeededGuest,
  snapshotRestaurantMollieState,
  setRestaurantMollieBroken,
  setRestaurantPausedBillingSuspended,
  restoreRestaurantMollieState,
} from '../fixtures/seed-alerts'

const ALERTS_REGION = 'Meldingen'

test.describe('Vandaag alert strip (D1.2)', () => {
  test('no alerts on an empty day — strip absent', async ({ page }) => {
    await wipeTestRestaurant()
    await signInAsTestOwner(page)

    await page.goto('/dashboard')

    await expect(page.getByRole('region', { name: ALERTS_REGION })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Nu en straks' })).toBeVisible()

    await wipeTestRestaurant()
  })

  test('five data-backed alerts render in priority order', async ({ page }) => {
    await wipeTestRestaurant()

    await seedPaymentFailedToday()
    await seedOrderReadyStale()
    await seedTabOpenLong()
    const { guestId } = await seedBookingDepositPending()
    await seedNotificationFailedToday()

    try {
      await signInAsTestOwner(page)
      await page.goto('/dashboard')

      const region = page.getByRole('region', { name: ALERTS_REGION })
      await expect(region).toBeVisible()

      const items = region.locator('li')
      await expect(items).toHaveCount(5)

      // DOM order must follow PRD priority: payments(2), ready(3), tabs(4),
      // deposit(5), notifications(6) — Mollie(1) not seeded in this test.
      await expect(items.nth(0)).toContainText('mislukte betaling')
      await expect(items.nth(1)).toContainText('langer dan 10 minuten klaar')
      await expect(items.nth(2)).toContainText('langer dan 4 uur')
      await expect(items.nth(3)).toContainText('wacht op aanbetaling')
      await expect(items.nth(4)).toContainText('kon vandaag niet worden bezorgd')

      await expect(items.nth(0).getByRole('link')).toHaveAttribute(
        'href',
        '/dashboard/orders?filter=payment_failed'
      )
      await expect(items.nth(1).getByRole('link')).toHaveAttribute(
        'href',
        '/dashboard/orders?filter=ready_stale'
      )
      await expect(items.nth(2).getByRole('link')).toHaveAttribute('href', '/dashboard/tabs')
      await expect(items.nth(3).getByRole('link')).toHaveAttribute(
        'href',
        '/dashboard/bookings?filter=deposit_pending'
      )
      await expect(items.nth(4).getByRole('link')).toHaveAttribute(
        'href',
        '/dashboard/settings/notifications'
      )
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededGuest(guestId)
    }
  })

  test('Mollie-broken alert is role-gated and takes priority 1', async ({ page }) => {
    await wipeTestRestaurant()
    const snapshot = await snapshotRestaurantMollieState()
    await setRestaurantMollieBroken()
    await seedTabOpenLong()

    try {
      await signInAsTestOwner(page)
      await page.goto('/dashboard')

      const region = page.getByRole('region', { name: ALERTS_REGION })
      const items = region.locator('li')
      await expect(items).toHaveCount(2)
      await expect(items.nth(0)).toContainText('Mollie')
      await expect(items.nth(1)).toContainText('langer dan 4 uur')
    } finally {
      await restoreRestaurantMollieState(snapshot)
      await wipeTestRestaurant()
    }
  })

  test('dismissal persists across polls, resets when storage is cleared', async ({ page }) => {
    await wipeTestRestaurant()
    await seedTabOpenLong()

    try {
      await signInAsTestOwner(page)
      await page.goto('/dashboard?pollMs=1500')

      const region = page.getByRole('region', { name: ALERTS_REGION })
      await expect(region).toBeVisible()

      await page.getByRole('button', { name: 'Sluiten' }).click()
      await expect(region).toHaveCount(0)

      // Two poll cycles at 1.5s — dismissal must survive the payload refresh.
      await page.waitForTimeout(3200)
      await expect(region).toHaveCount(0)

      // Simulate a day flip: the dismissal store is keyed by civil date, so
      // clearing it reproduces exactly what a new day's empty key looks like.
      await page.evaluate(() => localStorage.removeItem('tafel.dashboard.alerts.dismissed'))
      await page.reload()

      await expect(page.getByRole('region', { name: ALERTS_REGION })).toBeVisible()
    } finally {
      await wipeTestRestaurant()
    }
  })

  test('billing-suspended pause suppresses only the Mollie alert', async ({ page }) => {
    await wipeTestRestaurant()
    const snapshot = await snapshotRestaurantMollieState()
    await setRestaurantMollieBroken()
    await setRestaurantPausedBillingSuspended()
    await seedTabOpenLong()

    try {
      await signInAsTestOwner(page)
      await page.goto('/dashboard')

      const region = page.getByRole('region', { name: ALERTS_REGION })
      const items = region.locator('li')
      await expect(items).toHaveCount(1)
      await expect(items.nth(0)).toContainText('langer dan 4 uur')
      await expect(region).not.toContainText('Mollie')
    } finally {
      await restoreRestaurantMollieState(snapshot)
      await wipeTestRestaurant()
    }
  })
})
