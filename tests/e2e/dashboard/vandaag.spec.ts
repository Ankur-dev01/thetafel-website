import { test, expect } from '../fixtures/base'
import { wipeTestRestaurant, TEST_RESTAURANT_ID } from '../fixtures/test-restaurant'
import { signInAsTestOwner } from '../fixtures/dashboard-auth'
import { seedTodayBookings, cleanupSeededGuests } from '../fixtures/seed-today'

/**
 * Booking/pickup times below are computed relative to the actual test run
 * time (Europe/Amsterdam), not fixed wall-clock values — the Vandaag split
 * between "Nu en straks" and "Eerder vandaag" depends on the server clock
 * at request time, so pinning to e.g. "19:00" would make this suite flaky
 * depending on when it runs. Offsets stay small (±1–3.5h) to avoid crossing
 * the Amsterdam midnight boundary during normal daytime test runs.
 */
function amsterdamTimeAtOffset(hoursFromNow: number): string {
  const target = new Date(Date.now() + hoursFromNow * 3600_000)
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Amsterdam',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(target)
}

test.describe('Vandaag (D1.1)', () => {
  test('empty day renders zeroed tiles and the empty-state timeline', async ({ page }) => {
    await wipeTestRestaurant()
    await signInAsTestOwner(page)

    await page.goto('/dashboard')

    await expect(page.getByTestId('tile-bookings')).toContainText('0')
    await expect(page.getByTestId('tile-orders')).toContainText('0')
    await expect(page.getByTestId('tile-tabs')).toContainText('0')
    await expect(page.getByTestId('tile-expected')).toContainText('0')

    await expect(
      page.getByRole('heading', { name: 'Nog geen reserveringen voor vandaag' })
    ).toBeVisible()

    const walkinButton = page.getByRole('link', { name: '+ Walk-in toevoegen' })
    await expect(walkinButton).toBeVisible()
    await expect(walkinButton).toBeEnabled()

    await expect(page.getByText('Actieve bestellingen')).toHaveCount(0)

    await wipeTestRestaurant()
  })

  test('populated day renders tiles, timeline split, and queue snapshot', async ({ page }) => {
    await wipeTestRestaurant()

    const futureNearTime = amsterdamTimeAtOffset(2)
    const futureFarTime = amsterdamTimeAtOffset(3.5)
    const pastTime = amsterdamTimeAtOffset(-1)
    const pickupTime = amsterdamTimeAtOffset(2.25)

    const seeded = await seedTodayBookings({
      restaurantId: TEST_RESTAURANT_ID,
      bookings: [
        { localTime: futureNearTime, partySize: 2, status: 'confirmed', source: 'online' },
        { localTime: futureFarTime, partySize: 4, status: 'confirmed', source: 'online' },
        { localTime: pastTime, partySize: 3, status: 'attended', source: 'walk_in' },
      ],
      orders: [
        {
          orderType: 'takeaway',
          status: 'preparing',
          totalCents: 3450,
          paymentStatus: 'paid',
          pickupLocalTime: pickupTime,
          minutesAgoCreated: 30,
        },
        {
          orderType: 'qr',
          status: 'ready',
          totalCents: 2200,
          paymentStatus: 'paid',
          minutesAgoCreated: 10,
        },
      ],
    })

    try {
      await signInAsTestOwner(page)
      await page.goto('/dashboard')

      await expect(page.getByTestId('tile-bookings')).toContainText('3')
      await expect(page.getByTestId('tile-bookings')).toContainText('9')

      await expect(page.getByTestId('tile-orders')).toContainText('2')
      await expect(page.getByTestId('tile-orders')).toContainText('56,50')

      // Soft assertion — depends on server clock at request time relative to
      // the seeded future bookings, hence "soft" rather than an exact number.
      const expectedText = await page.getByTestId('tile-expected').innerText()
      const expectedValue = Number(expectedText.match(/\d+/)?.[0] ?? '0')
      expect(expectedValue).toBeGreaterThan(0)
      expect(expectedValue).toBeLessThan(9)

      // "Nu en straks" heading is present, and the near-future booking time
      // plus the takeaway pickup row render above the past-collapse.
      await expect(page.getByRole('heading', { name: 'Nu en straks' })).toBeVisible()
      await expect(page.getByText(futureNearTime)).toBeVisible()
      await expect(page.getByText(/^Afhaal —/)).toBeVisible()

      // "Eerder vandaag" collapse is present and contains the walk-in row.
      const pastDisclosure = page.locator('details', { hasText: 'Eerder vandaag' })
      await expect(pastDisclosure).toBeVisible()
      await expect(pastDisclosure.getByText('walk-in')).toBeHidden()

      await pastDisclosure.locator('summary').click()
      await expect(pastDisclosure.getByText('walk-in')).toBeVisible()
      await expect(pastDisclosure.getByText(pastTime)).toBeVisible()

      // Order queue snapshot lists both orders.
      await expect(page.getByRole('heading', { name: 'Actieve bestellingen' })).toBeVisible()
      await expect(page.getByText('QR ·')).toBeVisible()
      await expect(page.getByText('Afhaal ·')).toBeVisible()

      // Confirmed-booking action stub is present.
      await expect(page.getByTestId('timeline-mark-attended-stub').first()).toBeVisible()
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededGuests(seeded.guestIds)
    }
  })

  test('polling disconnect shows the strip, retry clears it', async ({ page }) => {
    await wipeTestRestaurant()

    const seeded = await seedTodayBookings({
      restaurantId: TEST_RESTAURANT_ID,
      bookings: [
        { localTime: amsterdamTimeAtOffset(1), partySize: 2, status: 'confirmed' },
      ],
    })

    try {
      await signInAsTestOwner(page)

      let failuresServed = 0
      await page.route('**/api/dashboard/today', async (route) => {
        if (failuresServed < 3) {
          failuresServed += 1
          await route.fulfill({ status: 500, body: 'seeded failure' })
        } else {
          await route.continue()
        }
      })

      await page.goto('/dashboard')

      await expect(page.getByText('Verbinding verbroken')).toBeVisible({ timeout: 20_000 })

      await page.unroute('**/api/dashboard/today')
      await page.getByRole('button', { name: 'Opnieuw proberen' }).click()

      await expect(page.getByText('Verbinding verbroken')).toBeHidden({ timeout: 10_000 })
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededGuests(seeded.guestIds)
    }
  })
})
