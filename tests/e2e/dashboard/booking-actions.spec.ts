import { test, expect } from '../fixtures/base'
import { wipeTestRestaurant, TEST_RESTAURANT_ID, TEST_RESTAURANT_ZONE_ID, TEST_RESTAURANT_TABLE_ID, adminClient } from '../fixtures/test-restaurant'
import { signInAsTestOwner } from '../fixtures/dashboard-auth'
import { seedBookingForAction, cleanupSeededBookingDetail } from '../fixtures/seed-booking-detail'
import { amsterdamWallClockToUtc } from '@/lib/booking/queries'
import type { Page } from '@playwright/test'

// Edit-route tests (7-9) anchor to a fixed Amsterdam wall-clock time
// tomorrow, safely mid-window (the test restaurant is open 11:00-22:00 every
// day) — using "now + N hours" would drift outside the opening window
// depending on what time of day the suite happens to run.
function amsterdamCivilDateTomorrow(): string {
  const tomorrow = new Date(Date.now() + 24 * 3600_000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(tomorrow)
}

// Same dual-mount issue as booking-detail.spec.ts: BookingDetail always
// renders both its desktop and phone bodies (CSS toggles visibility), so any
// copy can exist twice in the DOM. Scope to the visible one.
function desktopBody(page: Page) {
  return page.locator('[data-testid="detail-body-desktop"]:visible')
}

async function getOwnerStaffId(): Promise<string> {
  const supabase = adminClient()
  const { data } = await supabase
    .from('restaurant_staff')
    .select('id')
    .eq('restaurant_id', TEST_RESTAURANT_ID)
    .eq('role', 'owner')
    .maybeSingle()
  if (!data) throw new Error('[booking-actions.spec] no owner staff row found for test restaurant')
  return data.id as string
}

async function getBooking(bookingId: string) {
  const supabase = adminClient()
  const { data } = await supabase.from('bookings').select('*').eq('id', bookingId).maybeSingle()
  return data
}

async function getAuditRows(bookingId: string, eventType: string) {
  const supabase = adminClient()
  const { data } = await supabase
    .from('dashboard_audit_logs')
    .select('*')
    .eq('booking_id', bookingId)
    .eq('event_type', eventType)
  return data ?? []
}

test.describe('Booking actions (D2.3)', () => {
  test('attend happy path', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()

    const seeded = await seedBookingForAction({
      restaurantId: TEST_RESTAURANT_ID,
      slotTime: new Date(Date.now() - 5 * 60_000),
      status: 'confirmed',
      zoneId: TEST_RESTAURANT_ZONE_ID,
      tableIds: [TEST_RESTAURANT_TABLE_ID],
    })

    try {
      await signInAsTestOwner(page)
      await page.goto(`/dashboard/bookings?booking=${seeded.bookingId}`)

      await page.locator('[data-testid="detail-mark-attended"]:visible').click()
      // "Aangekomen" is ambiguous with the button's own label, so wait for
      // the button itself to disappear (canMarkAttended flips false once the
      // async mutation + refresh land) rather than for that text.
      await expect(page.locator('[data-testid="detail-mark-attended"]:visible')).toHaveCount(0, { timeout: 15_000 })

      const booking = await getBooking(seeded.bookingId)
      expect(booking?.status).toBe('attended')
      expect(booking?.attended_at).toBeTruthy()
      expect(booking?.attended_marked_by).toBe(await getOwnerStaffId())

      const audit = await getAuditRows(seeded.bookingId, 'booking.marked_attended')
      expect(audit.length).toBe(1)
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededBookingDetail(seeded.guestId)
    }
  })

  test('attend from terminal state returns 409, no audit', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()

    const seeded = await seedBookingForAction({
      restaurantId: TEST_RESTAURANT_ID,
      slotTime: new Date(Date.now() - 60 * 60_000),
      status: 'cancelled',
    })

    try {
      await signInAsTestOwner(page)
      const res = await page.request.post(`/api/dashboard/bookings/${seeded.bookingId}/attend`)
      expect(res.status()).toBe(409)
      const json = await res.json()
      expect(json.error).toBe('terminal_state')

      const audit = await getAuditRows(seeded.bookingId, 'booking.marked_attended')
      expect(audit.length).toBe(0)
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededBookingDetail(seeded.guestId)
    }
  })

  test('no-show happy path (past grace)', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()

    const seeded = await seedBookingForAction({
      restaurantId: TEST_RESTAURANT_ID,
      slotTime: new Date(Date.now() - 45 * 60_000),
      status: 'confirmed',
      zoneId: TEST_RESTAURANT_ZONE_ID,
      tableIds: [TEST_RESTAURANT_TABLE_ID],
    })

    try {
      await signInAsTestOwner(page)
      await page.goto(`/dashboard/bookings?booking=${seeded.bookingId}`)

      await page.locator('[data-testid="detail-mark-noshow"]:visible').click()
      // Same ambiguity as attend: "No-show" is also the button's own label.
      // Wait for it to disappear (canMarkNoShow requires status='confirmed').
      await expect(page.locator('[data-testid="detail-mark-noshow"]:visible')).toHaveCount(0, { timeout: 15_000 })

      const booking = await getBooking(seeded.bookingId)
      expect(booking?.status).toBe('no_show')

      const audit = await getAuditRows(seeded.bookingId, 'booking.marked_no_show')
      expect(audit.length).toBe(1)
      expect(audit[0].event_data.minutes_after_slot).toBeGreaterThanOrEqual(44)
      expect(audit[0].event_data.minutes_after_slot).toBeLessThanOrEqual(46)
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededBookingDetail(seeded.guestId)
    }
  })

  test('no-show before grace window is blocked', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()

    const seeded = await seedBookingForAction({
      restaurantId: TEST_RESTAURANT_ID,
      slotTime: new Date(Date.now() + 30 * 60_000),
      status: 'confirmed',
      zoneId: TEST_RESTAURANT_ZONE_ID,
      tableIds: [TEST_RESTAURANT_TABLE_ID],
    })

    try {
      await signInAsTestOwner(page)
      await page.goto(`/dashboard/bookings?booking=${seeded.bookingId}`)

      const noShowButton = page.locator('[data-testid="detail-mark-noshow"]:visible')
      await expect(noShowButton).toBeDisabled()
      await expect(noShowButton).toHaveAttribute('title', 'Beschikbaar 30 min na starttijd')

      const res = await page.request.post(`/api/dashboard/bookings/${seeded.bookingId}/no-show`)
      expect(res.status()).toBe(409)
      expect((await res.json()).error).toBe('too_early')
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededBookingDetail(seeded.guestId)
    }
  })

  test('cancel with paid deposit shows info line and captures deposit state', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()

    const seeded = await seedBookingForAction({
      restaurantId: TEST_RESTAURANT_ID,
      slotTime: new Date(Date.now() + 60 * 60_000),
      status: 'confirmed',
      zoneId: TEST_RESTAURANT_ZONE_ID,
      tableIds: [TEST_RESTAURANT_TABLE_ID],
      depositAmountCents: 3500,
      depositIntentStatus: 'paid',
    })

    try {
      await signInAsTestOwner(page)
      await page.goto(`/dashboard/bookings?booking=${seeded.bookingId}`)

      await page.locator('[data-testid="detail-cancel"]:visible').click()
      await expect(page.getByText(/€\s*35,00/).first()).toBeVisible()
      await expect(page.getByText(/blijft nog staan/).first()).toBeVisible()

      await page.locator('#cancel-reason').fill('Gast belde af.')
      await page.getByRole('button', { name: 'Ja, annuleer' }).click()

      const body = desktopBody(page)
      await expect(body.getByText('Geannuleerd').first()).toBeVisible({ timeout: 15_000 })

      const booking = await getBooking(seeded.bookingId)
      expect(booking?.status).toBe('cancelled')
      expect(booking?.cancelled_at).toBeTruthy()
      expect(booking?.cancelled_by).toBe('restaurant')

      const audit = await getAuditRows(seeded.bookingId, 'booking.cancelled_by_staff')
      expect(audit.length).toBe(1)
      expect(audit[0].event_data.deposit_state).toBe('paid')
      expect(audit[0].event_data.deposit_amount_cents).toBe(3500)
      expect(audit[0].event_data.reason).toBe('Gast belde af.')
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededBookingDetail(seeded.guestId)
    }
  })

  test('cancel confirmed booking with no deposit, no reason', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()

    const seeded = await seedBookingForAction({
      restaurantId: TEST_RESTAURANT_ID,
      slotTime: new Date(Date.now() + 60 * 60_000),
      status: 'confirmed',
      zoneId: TEST_RESTAURANT_ZONE_ID,
      tableIds: [TEST_RESTAURANT_TABLE_ID],
    })

    try {
      await signInAsTestOwner(page)
      await page.goto(`/dashboard/bookings?booking=${seeded.bookingId}`)

      await page.locator('[data-testid="detail-cancel"]:visible').click()
      await page.getByRole('button', { name: 'Ja, annuleer' }).click()

      const body = desktopBody(page)
      await expect(body.getByText('Geannuleerd').first()).toBeVisible({ timeout: 15_000 })

      const audit = await getAuditRows(seeded.bookingId, 'booking.cancelled_by_staff')
      expect(audit.length).toBe(1)
      expect(audit[0].event_data.deposit_state).toBe('not_required')
      expect(audit[0].event_data.reason).toBeNull()
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededBookingDetail(seeded.guestId)
    }
  })

  test('edit slot_time happy path', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()

    const civilDate = amsterdamCivilDateTomorrow()
    const slotTime = amsterdamWallClockToUtc(civilDate, '15:00:00')

    const seeded = await seedBookingForAction({
      restaurantId: TEST_RESTAURANT_ID,
      slotTime,
      status: 'confirmed',
      partySize: 2,
      zoneId: TEST_RESTAURANT_ZONE_ID,
      tableIds: [TEST_RESTAURANT_TABLE_ID],
    })

    try {
      await signInAsTestOwner(page)
      await page.goto(`/dashboard/bookings?booking=${seeded.bookingId}`)

      await page.locator('[data-testid="detail-edit"]:visible').click()
      const dialog = page.getByRole('dialog', { name: 'Reservering bewerken' })
      await expect(dialog).toBeVisible()
      const timeInput = page.locator('input[type="time"]:visible')
      await timeInput.fill('16:00')
      await page.getByRole('button', { name: 'Opslaan' }).click()

      // The dialog only closes inside handleSubmit after the async edit
      // request succeeds — waiting for it to disappear is what actually
      // synchronizes with the mutation completing (unlike checking for the
      // edit button, which is present regardless of timing).
      await expect(dialog).toHaveCount(0, { timeout: 15_000 })

      const booking = await getBooking(seeded.bookingId)
      const expectedSlot = amsterdamWallClockToUtc(civilDate, '16:00:00')
      expect(new Date(booking!.slot_time).toISOString()).toBe(expectedSlot.toISOString())

      const audit = await getAuditRows(seeded.bookingId, 'booking.edited')
      expect(audit.length).toBe(1)
      expect(audit[0].event_data.changes.slot_time).toBeTruthy()
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededBookingDetail(seeded.guestId)
    }
  })

  test('edit that violates half-full rule is rejected, no audit', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()

    const slotTime = amsterdamWallClockToUtc(amsterdamCivilDateTomorrow(), '15:00:00')
    const seeded = await seedBookingForAction({
      restaurantId: TEST_RESTAURANT_ID,
      slotTime,
      status: 'confirmed',
      partySize: 2,
      zoneId: TEST_RESTAURANT_ZONE_ID,
      tableIds: [TEST_RESTAURANT_TABLE_ID],
    })

    try {
      await signInAsTestOwner(page)
      await page.goto(`/dashboard/bookings?booking=${seeded.bookingId}`)

      await page.locator('[data-testid="detail-edit"]:visible').click()
      const partyInput = page.locator('input[type="number"]:visible')
      await partyInput.fill('1')
      await page.getByRole('button', { name: 'Opslaan' }).click()

      await expect(page.getByText('Te veel plek voor het aantal gasten').first()).toBeVisible({ timeout: 15_000 })

      const booking = await getBooking(seeded.bookingId)
      expect(booking?.party_size).toBe(2)

      const audit = await getAuditRows(seeded.bookingId, 'booking.edited')
      expect(audit.length).toBe(0)
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededBookingDetail(seeded.guestId)
    }
  })

  test('edit that conflicts with another booking on the same table is rejected', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()

    const civilDate = amsterdamCivilDateTomorrow()
    const slotA = amsterdamWallClockToUtc(civilDate, '15:00:00')
    const slotB = amsterdamWallClockToUtc(civilDate, '15:30:00')

    const seededA = await seedBookingForAction({
      restaurantId: TEST_RESTAURANT_ID,
      slotTime: slotA,
      status: 'confirmed',
      partySize: 2,
      durationMinutes: 90,
      zoneId: TEST_RESTAURANT_ZONE_ID,
      tableIds: [TEST_RESTAURANT_TABLE_ID],
    })
    const seededB = await seedBookingForAction({
      restaurantId: TEST_RESTAURANT_ID,
      slotTime: slotB,
      status: 'confirmed',
      partySize: 2,
      durationMinutes: 90,
      zoneId: TEST_RESTAURANT_ZONE_ID,
      tableIds: [TEST_RESTAURANT_TABLE_ID],
    })

    try {
      await signInAsTestOwner(page)
      await page.goto(`/dashboard/bookings?booking=${seededA.bookingId}`)

      await page.locator('[data-testid="detail-edit"]:visible').click()
      const timeInput = page.locator('input[type="time"]:visible')
      const conflictTime = new Date(slotA.getTime() + 75 * 60_000)
      // The dialog's time input is interpreted as Europe/Amsterdam wall-clock
      // time (amsterdamWallClockToUtc), not the test runner's local timezone —
      // format accordingly rather than using local getHours()/getMinutes().
      const amsterdamHHMM = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Amsterdam',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(conflictTime)
      await timeInput.fill(amsterdamHHMM)
      await page.getByRole('button', { name: 'Opslaan' }).click()

      await expect(page.getByText('Deze tafel is al bezet op deze tijd.').first()).toBeVisible({ timeout: 15_000 })

      const bookingA = await getBooking(seededA.bookingId)
      expect(new Date(bookingA!.slot_time).toISOString()).toBe(slotA.toISOString())

      const audit = await getAuditRows(seededA.bookingId, 'booking.edited')
      expect(audit.length).toBe(0)
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededBookingDetail(seededA.guestId)
      await cleanupSeededBookingDetail(seededB.guestId)
    }
  })

  test('concurrent attend double-fire is idempotent — one 200, one 409, one audit row', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()

    const seeded = await seedBookingForAction({
      restaurantId: TEST_RESTAURANT_ID,
      slotTime: new Date(Date.now() - 5 * 60_000),
      status: 'confirmed',
      zoneId: TEST_RESTAURANT_ZONE_ID,
      tableIds: [TEST_RESTAURANT_TABLE_ID],
    })

    try {
      await signInAsTestOwner(page)

      const [res1, res2] = await Promise.all([
        page.request.post(`/api/dashboard/bookings/${seeded.bookingId}/attend`),
        page.request.post(`/api/dashboard/bookings/${seeded.bookingId}/attend`),
      ])
      const statuses = [res1.status(), res2.status()].sort()
      expect(statuses).toEqual([200, 409])

      const audit = await getAuditRows(seeded.bookingId, 'booking.marked_attended')
      expect(audit.length).toBe(1)
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededBookingDetail(seeded.guestId)
    }
  })
})
