import { test, expect } from '../fixtures/base'
import { wipeTestRestaurant, TEST_RESTAURANT_ID } from '../fixtures/test-restaurant'
import { signInAsTestOwner } from '../fixtures/dashboard-auth'
import { seedBookingDetail, cleanupSeededBookingDetail } from '../fixtures/seed-booking-detail'
import type { Page } from '@playwright/test'

// BookingDetail always mounts BOTH its desktop-stack and phone-tabs bodies
// (CSS toggles which is visible), and BookingsClient always mounts both
// DetailPanel and DetailSheet the same way (D2.1's pattern) — so any given
// piece of copy exists in up to 4 places in the DOM at once. Scope every
// assertion to whichever body is actually :visible for the test's viewport.
function desktopBody(page: Page) {
  return page.locator('[data-testid="detail-body-desktop"]:visible')
}
function phoneBody(page: Page) {
  return page.locator('[data-testid="detail-body-phone"]:visible')
}

test.describe('Reservation detail depth (D2.2)', () => {
  test('first-time guest, minimal booking', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()

    const seeded = await seedBookingDetail({
      restaurantId: TEST_RESTAURANT_ID,
      bookingLocalTime: '20:00',
      bookingStatus: 'confirmed',
    })

    try {
      await signInAsTestOwner(page)
      await page.goto(`/dashboard/bookings?booking=${seeded.bookingId}`)

      const body = desktopBody(page)
      await expect(body.getByText('geen bezoeken', { exact: true })).toBeVisible()
      await expect(body.getByText('Eerste bezoek — welkom.')).toBeVisible()

      await expect(body.getByText('Geen notitie')).toBeVisible()
      const addNoteStub = page.locator('[data-testid="detail-add-note-stub"]:visible')
      await expect(addNoteStub).toBeVisible()
      await expect(addNoteStub).toBeDisabled()

      await expect(body.getByText('Nog geen activiteit.')).toBeVisible()

      // No deposit, no delivery events seeded — the whole block must be absent.
      await expect(body.getByText('Communicatie')).toHaveCount(0)

      await expect(page.locator('[data-testid="detail-mark-attended-stub"]:visible')).toBeVisible()
      await expect(page.locator('[data-testid="detail-mark-attended-stub"]:visible')).toBeDisabled()
      await expect(page.locator('[data-testid="detail-cancel-stub"]:visible')).toBeVisible()
      await expect(page.locator('[data-testid="detail-edit-stub"]:visible')).toBeVisible()
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededBookingDetail(seeded.guestId)
    }
  })

  test('repeat guest with history', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()

    const seeded = await seedBookingDetail({
      restaurantId: TEST_RESTAURANT_ID,
      bookingLocalTime: '20:00',
      bookingStatus: 'confirmed',
      priorBookings: [
        { localTime: '19:00', daysAgo: 30, status: 'attended' },
        { localTime: '19:00', daysAgo: 60, status: 'attended' },
        { localTime: '19:00', daysAgo: 90, status: 'attended' },
        { localTime: '19:00', daysAgo: 45, status: 'cancelled' },
        { localTime: '19:00', daysAgo: 20, status: 'no_show' },
      ],
    })

    try {
      await signInAsTestOwner(page)
      await page.goto(`/dashboard/bookings?booking=${seeded.bookingId}`)

      const body = desktopBody(page)
      // 3 attended priors + this booking (confirmed, not attended) → 3.
      await expect(body.getByText('3 bezoeken', { exact: true })).toBeVisible()
      await expect(body.getByText(/Laatste keer op/)).toBeVisible()
      await expect(body.getByText('1 eerdere no-show', { exact: true })).toBeVisible()
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededBookingDetail(seeded.guestId)
    }
  })

  test('guest with restaurant note', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()

    const seeded = await seedBookingDetail({
      restaurantId: TEST_RESTAURANT_ID,
      bookingLocalTime: '20:00',
      bookingStatus: 'confirmed',
      restaurantNote: "Allergisch voor pinda's. Geeft grote fooi.",
    })

    try {
      await signInAsTestOwner(page)
      await page.goto(`/dashboard/bookings?booking=${seeded.bookingId}`)

      const body = desktopBody(page)
      await expect(body.getByText("Allergisch voor pinda's. Geeft grote fooi.")).toBeVisible()
      await expect(body.getByText(/Bijgewerkt op .* door/)).toBeVisible()
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededBookingDetail(seeded.guestId)
    }
  })

  test('full delivery timeline', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()

    const seeded = await seedBookingDetail({
      restaurantId: TEST_RESTAURANT_ID,
      bookingLocalTime: '20:00',
      bookingStatus: 'confirmed',
      depositAmountCents: 3000,
      depositIntentStatus: 'paid',
      deliveryEvents: [
        { eventType: 'booking.create.succeeded', minutesAgo: 35 },
        { eventType: 'email.sent', minutesAgo: 30 },
      ],
    })

    try {
      await signInAsTestOwner(page)
      await page.goto(`/dashboard/bookings?booking=${seeded.bookingId}`)

      const body = desktopBody(page)
      await expect(body.getByText('Communicatie')).toBeVisible()
      await expect(body.getByText('Betaald', { exact: true })).toBeVisible()
      await expect(body.getByText('€ 30,00', { exact: true })).toBeVisible()
      await expect(body.getByText('Verzonden', { exact: true })).toBeVisible()
      await expect(body.getByText('Herinnering')).toHaveCount(0)
      await expect(body.getByText('WhatsApp')).toHaveCount(0)

      await expect(body.getByText('Reservering gemaakt')).toBeVisible()
      await expect(body.getByText('Mail verzonden')).toBeVisible()
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededBookingDetail(seeded.guestId)
    }
  })

  test('phone tabs', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()

    const seeded = await seedBookingDetail({
      restaurantId: TEST_RESTAURANT_ID,
      bookingLocalTime: '20:00',
      bookingStatus: 'confirmed',
      depositAmountCents: 3000,
      depositIntentStatus: 'paid',
      deliveryEvents: [{ eventType: 'email.sent', minutesAgo: 10 }],
      restaurantNote: 'Zit graag bij het raam.',
    })

    try {
      await signInAsTestOwner(page)
      await page.setViewportSize({ width: 375, height: 812 })
      await page.goto(`/dashboard/bookings?booking=${seeded.bookingId}`)

      const body = phoneBody(page)
      await expect(body.getByRole('tab', { name: 'Overzicht' })).toBeVisible()
      await expect(body.getByText('Communicatie')).toBeVisible()

      await body.getByRole('tab', { name: 'Historie' }).click()
      await expect(body.getByText('Mail verzonden')).toBeVisible()

      await body.getByRole('tab', { name: 'Gast' }).click()
      await expect(body.getByText('Zit graag bij het raam.')).toBeVisible()

      await body.getByRole('tab', { name: 'Overzicht' }).click()
      await expect(body.getByText('Communicatie')).toBeVisible()

      await expect(page).toHaveURL(new RegExp(`booking=${seeded.bookingId}`))

      // The DetailSheet backdrop is fully covered by its w-full panel at
      // phone viewport widths, so there's no reachable backdrop area to tap
      // here — use the sheet's visible close button instead.
      await page.locator('.md\\:hidden button[aria-label="Sluiten"]:visible').click()
      await expect(page).not.toHaveURL(/booking=/)
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededBookingDetail(seeded.guestId)
    }
  })

  // Test 6 (cross-restaurant privacy) intentionally dropped — see D2.2 report.
  // getBookingDetail's guest-history query filters explicitly on
  // `restaurant_id = $1` (lib/dashboard/queries/bookings.ts,
  // `getBookingDetail`'s parallel Promise.all block, first entry), on top of
  // RLS's own restaurant-scoped policy. Seeding a second live restaurant's
  // guest history for this test would mean writing to Karan's or Ankur's
  // real onboarding restaurant, which the standing rules explicitly forbid;
  // spinning up a third synthetic restaurant purely for one test's lifetime
  // is D9-grade cross-restaurant test-isolation infrastructure, not a D2.2
  // concern. Revisit in D9 if isolation tooling lands.
})
