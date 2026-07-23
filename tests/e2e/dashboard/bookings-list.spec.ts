import { test, expect } from '../fixtures/base'
import { wipeTestRestaurant, TEST_RESTAURANT_ID } from '../fixtures/test-restaurant'
import { signInAsTestOwner } from '../fixtures/dashboard-auth'
import { seedBookingsDay, cleanupSeededGuests } from '../fixtures/seed-bookings-day'

function amsterdamCivilDateToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date())
}

function amsterdamCivilDateOffset(days: number): string {
  const [y, m, d] = amsterdamCivilDateToday().split('-').map(Number)
  const utc = new Date(Date.UTC(y, m - 1, d))
  utc.setUTCDate(utc.getUTCDate() + days)
  return utc.toISOString().slice(0, 10)
}

test.describe('Reserveringen list (D2.1)', () => {
  test('empty day', async ({ page }) => {
    await wipeTestRestaurant()
    await signInAsTestOwner(page)

    await page.goto('/dashboard/bookings')

    await expect(page.getByText('vandaag', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Geen reserveringen op deze dag' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Lunch' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Diner' })).toHaveCount(0)

    await wipeTestRestaurant()
  })

  test('populated day, grouped by service window', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()
    const today = amsterdamCivilDateToday()

    const seeded = await seedBookingsDay({
      restaurantId: TEST_RESTAURANT_ID,
      civilDate: today,
      bookings: [
        { localTime: '12:15', partySize: 2, status: 'confirmed' },
        { localTime: '12:45', partySize: 3, status: 'confirmed', depositAmountCents: 2500 },
        { localTime: '13:30', partySize: 4, status: 'attended', source: 'walk_in' },
        { localTime: '19:00', partySize: 2, status: 'pending' },
        { localTime: '19:30', partySize: 3, status: 'confirmed' },
        { localTime: '20:00', partySize: 2, status: 'cancelled' },
        { localTime: '21:00', partySize: 5, status: 'no_show' },
      ],
    })

    try {
      await signInAsTestOwner(page)
      await page.goto('/dashboard/bookings')

      const lunchHeading = page.getByRole('heading', { name: 'Lunch' })
      const dinnerHeading = page.getByRole('heading', { name: 'Diner' })
      await expect(lunchHeading).toBeVisible()
      await expect(dinnerHeading).toBeVisible()

      // Rows are plain siblings after each heading — count via time text.
      await expect(page.getByText('12:15')).toBeVisible()
      await expect(page.getByText('12:45')).toBeVisible()
      await expect(page.getByText('13:30')).toBeVisible()
      await expect(page.getByText('19:00')).toBeVisible()
      await expect(page.getByText('19:30')).toBeVisible()
      await expect(page.getByText('20:00')).toBeVisible()
      await expect(page.getByText('21:00')).toBeVisible()

      await expect(page.getByText('Verwacht', { exact: true }).first()).toBeVisible()
      await expect(page.getByText('Aangekomen', { exact: true }).first()).toBeVisible()
      await expect(page.getByText('Geannuleerd', { exact: true }).first()).toBeVisible()
      await expect(page.getByText('No-show', { exact: true }).first()).toBeVisible()

      await expect(page.getByText('walk-in', { exact: true })).toBeVisible()
      await expect(page.getByText('Aanbetaling open', { exact: true }).first()).toBeVisible()
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededGuests(seeded.guestIds)
    }
  })

  test('filter chips update the URL and the list', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()
    const today = amsterdamCivilDateToday()

    const seeded = await seedBookingsDay({
      restaurantId: TEST_RESTAURANT_ID,
      civilDate: today,
      bookings: [
        { localTime: '12:15', partySize: 2, status: 'confirmed' },
        { localTime: '12:45', partySize: 3, status: 'confirmed', depositAmountCents: 2500 },
        { localTime: '13:30', partySize: 4, status: 'attended' },
        { localTime: '19:00', partySize: 2, status: 'pending' },
        { localTime: '19:30', partySize: 3, status: 'confirmed' },
        { localTime: '20:00', partySize: 2, status: 'cancelled' },
        { localTime: '21:00', partySize: 5, status: 'no_show' },
      ],
    })

    try {
      await signInAsTestOwner(page)
      await page.goto('/dashboard/bookings')

      await page.getByRole('button', { name: /^Verwacht/ }).click()
      await expect(page).toHaveURL(/filter=verwacht/)
      await expect(page.getByText('19:00')).toBeVisible()
      await expect(page.getByText('20:00')).toHaveCount(0)

      await page.getByRole('button', { name: /^Geannuleerd/ }).click()
      await expect(page).toHaveURL(/filter=geannuleerd/)
      await expect(page.getByText('20:00')).toBeVisible()
      await expect(page.getByText('19:00')).toHaveCount(0)

      await page.getByRole('button', { name: /^No-show/ }).click()
      await expect(page).toHaveURL(/filter=no_show/)
      await expect(page.getByText('21:00')).toBeVisible()

      await page.getByRole('button', { name: /^Aanbetaling open/ }).click()
      await expect(page).toHaveURL(/filter=deposit_pending/)
      await expect(page.getByText('12:45')).toBeVisible()

      await page.reload()
      await expect(page).toHaveURL(/filter=deposit_pending/)
      await expect(page.getByText('12:45')).toBeVisible()
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededGuests(seeded.guestIds)
    }
  })

  test('day navigation + deep-link clamping', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()
    const today = amsterdamCivilDateToday()
    const tomorrow = amsterdamCivilDateOffset(1)
    const tooFarPast = amsterdamCivilDateOffset(-40)

    const seeded = await seedBookingsDay({
      restaurantId: TEST_RESTAURANT_ID,
      civilDate: today,
      bookings: [{ localTime: '19:00', partySize: 2, status: 'confirmed' }],
    })

    try {
      await signInAsTestOwner(page)

      await page.goto(`/dashboard/bookings?date=${tomorrow}`)
      await expect(page.getByRole('heading', { name: 'Geen reserveringen op deze dag' })).toBeVisible()

      await page.getByRole('button', { name: 'Vandaag' }).click()
      await expect(page).toHaveURL(new RegExp(`date=${today}`))
      await expect(page.getByText('19:00')).toBeVisible()

      await page.goto(`/dashboard/bookings?date=${tooFarPast}`)
      await expect(page).toHaveURL(/\/dashboard\/bookings$/)

      await page.goto('/dashboard/bookings?date=garbage')
      await expect(page).toHaveURL(/\/dashboard\/bookings$/)
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededGuests(seeded.guestIds)
    }
  })

  test('detail panel opens/closes via URL', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()
    const today = amsterdamCivilDateToday()

    const seeded = await seedBookingsDay({
      restaurantId: TEST_RESTAURANT_ID,
      civilDate: today,
      bookings: [{ localTime: '20:00', partySize: 4, status: 'confirmed' }],
    })

    try {
      await signInAsTestOwner(page)
      await page.goto('/dashboard/bookings')

      await page.getByText('20:00').click()
      await expect(page).toHaveURL(/[?&]booking=/)
      // Both DetailPanel (desktop) and DetailSheet (phone) are mounted at all
      // times, toggled with CSS (hidden/md:hidden) — scope to the visible
      // one so the assertions match whichever the current viewport shows.
      await expect(page.locator('[data-testid="detail-mark-attended-stub"]:visible')).toBeVisible()
      await expect(page.locator('[data-testid="detail-mark-attended-stub"]:visible')).toBeDisabled()
      await expect(page.locator('[data-testid="detail-cancel-stub"]:visible')).toBeVisible()
      await expect(page.locator('[data-testid="detail-cancel-stub"]:visible')).toBeDisabled()
      await expect(page.locator('[data-testid="detail-edit-stub"]:visible')).toBeVisible()
      await expect(page.locator('[data-testid="detail-edit-stub"]:visible')).toBeDisabled()

      await page.reload()
      await expect(page).toHaveURL(/[?&]booking=/)
      await expect(page.locator('[data-testid="detail-edit-stub"]:visible')).toBeVisible()

      const currentUrl = new URL(page.url())
      currentUrl.searchParams.set('booking', '00000000-0000-0000-0000-000000000000')
      await page.goto(currentUrl.pathname + currentUrl.search)
      await expect(page.locator('[data-testid="detail-edit-stub"]:visible')).toHaveCount(0)
      await expect(page.getByText('20:00')).toBeVisible()

      await page.setViewportSize({ width: 375, height: 800 })
      await page.goto(`/dashboard/bookings?date=${today}&booking=${seeded.bookingIds[0]}`)
      await expect(page.locator('[data-testid="detail-edit-stub"]:visible')).toBeVisible()
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededGuests(seeded.guestIds)
    }
  })
})
