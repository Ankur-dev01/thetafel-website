import { test, expect } from '../fixtures/base'
import {
  wipeTestRestaurant,
  TEST_RESTAURANT_ID,
  TEST_RESTAURANT_ZONE_ID,
  TEST_RESTAURANT_TABLE_ID,
  adminClient,
} from '../fixtures/test-restaurant'
import { signInAsTestOwner } from '../fixtures/dashboard-auth'
import { seedExistingGuest, cleanupSeededExistingGuest } from '../fixtures/seed-existing-guest'
import { seedBookingForAction, cleanupSeededBookingDetail } from '../fixtures/seed-booking-detail'

async function getOwnerStaffId(): Promise<string> {
  const supabase = adminClient()
  const { data } = await supabase
    .from('restaurant_staff')
    .select('id')
    .eq('restaurant_id', TEST_RESTAURANT_ID)
    .eq('role', 'owner')
    .maybeSingle()
  if (!data) throw new Error('[walk-in.spec] no owner staff row found for test restaurant')
  return data.id as string
}

async function getWalkInBooking(): Promise<Record<string, unknown> | null> {
  const supabase = adminClient()
  const { data } = await supabase
    .from('bookings')
    .select('*')
    .eq('restaurant_id', TEST_RESTAURANT_ID)
    .eq('source', 'walk_in')
    .maybeSingle()
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

test.describe('Walk-in create (D2.4)', () => {
  test('anonymous walk-in (name only)', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()

    try {
      await signInAsTestOwner(page)
      await page.goto('/dashboard/bookings?walkin=1')

      const dialog = page.getByRole('dialog', { name: 'Walk-in toevoegen' })
      await expect(dialog).toBeVisible()

      await page.locator('[data-testid="walkin-name"]').fill('Jan Bakker')
      await page.locator('[data-testid="walkin-party"]').fill('2')
      await page.locator(`[data-testid="walkin-zone"]`).selectOption(TEST_RESTAURANT_ZONE_ID)
      await page.locator(`[data-testid="walkin-table-${TEST_RESTAURANT_TABLE_ID}"]`).check()
      await page.locator('[data-testid="walkin-submit"]').click()

      await expect(dialog).toHaveCount(0, { timeout: 15_000 })
      await expect(page.locator('[data-testid="walkin-success-toast"]')).toBeVisible()
      await expect(page.getByText('Walk-in toegevoegd', { exact: true })).toBeVisible()

      const booking = await getWalkInBooking()
      expect(booking).toBeTruthy()
      expect(booking?.status).toBe('attended')
      expect(booking?.source).toBe('walk_in')
      expect(booking?.party_size).toBe(2)
      expect(booking?.attended_marked_by).toBe(await getOwnerStaffId())
      expect(booking?.attended_at).toBeTruthy()

      const supabase = adminClient()
      const { data: guest } = await supabase
        .from('guests')
        .select('*')
        .eq('id', booking!.guest_id as string)
        .maybeSingle()
      expect(guest?.full_name).toBe('Jan Bakker')
      expect(guest?.email).toBeNull()
      expect(guest?.phone).toBeNull()

      const { data: bookingTables } = await supabase
        .from('booking_tables')
        .select('*')
        .eq('booking_id', booking!.id as string)
      expect(bookingTables?.length).toBe(1)
      expect(bookingTables?.[0].table_id).toBe(TEST_RESTAURANT_TABLE_ID)

      const audit = await getAuditRows(booking!.id as string, 'booking.walk_in.created')
      expect(audit.length).toBe(1)
      expect(audit[0].event_data.matched_existing_guest).toBe(false)
      expect(audit[0].event_data.visit_count_before).toBe(0)

      await cleanupSeededExistingGuest(guest!.id)
    } finally {
      await wipeTestRestaurant()
    }
  })

  test('walk-in matches existing guest at this restaurant', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()

    const seededGuest = await seedExistingGuest({
      restaurantId: TEST_RESTAURANT_ID,
      fullName: 'Sofia Vermeer',
      phoneE164: '+31612345678',
      priorVisitsDaysAgo: [90, 30, 7],
    })

    try {
      await signInAsTestOwner(page)
      await page.goto('/dashboard/bookings?walkin=1')

      const dialog = page.getByRole('dialog', { name: 'Walk-in toevoegen' })
      await expect(dialog).toBeVisible()

      await page.locator('[data-testid="walkin-name"]').fill('Sofia Vermeer')
      await page.locator('[data-testid="walkin-phone"]').fill('+31612345678')
      await page.locator('[data-testid="walkin-party"]').fill('2')
      await page.locator(`[data-testid="walkin-zone"]`).selectOption(TEST_RESTAURANT_ZONE_ID)
      await page.locator(`[data-testid="walkin-table-${TEST_RESTAURANT_TABLE_ID}"]`).check()
      await page.locator('[data-testid="walkin-submit"]').click()

      await expect(dialog).toHaveCount(0, { timeout: 15_000 })
      await expect(
        page.getByText('Walk-in toegevoegd · Gekoppeld aan Sofia Vermeer · 3 eerdere bezoeken', { exact: true }),
      ).toBeVisible()

      const booking = await getWalkInBooking()
      expect(booking?.guest_id).toBe(seededGuest.guestId)

      const audit = await getAuditRows(booking!.id as string, 'booking.walk_in.created')
      expect(audit.length).toBe(1)
      expect(audit[0].event_data.matched_existing_guest).toBe(true)
      expect(audit[0].event_data.visit_count_before).toBe(3)
      // booking.guest_id === seededGuest.guestId (asserted above) already
      // proves no duplicate guest row was created for this match — a raw
      // phone-uniqueness check isn't reliable here since `guests.phone` has
      // no global unique constraint and unrelated pre-existing rows can
      // coincidentally share a phone number.
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededExistingGuest(seededGuest.guestId)
    }
  })

  // Test 3 (cross-restaurant privacy) is intentionally not automated here: it
  // would require creating a second, synthetic restaurant for the test's
  // lifetime (the e2e suite is only permitted to write to
  // TEST_RESTAURANT_ID — see fixtures/test-restaurant.ts), which is more
  // fixture machinery than this guarantee is worth automating right now.
  // The guarantee itself — a phone match never crosses restaurant_id — is
  // structural: `findExistingGuestByPhoneAtRestaurant` (lib/dashboard/queries/
  // guests.ts) joins through `bookings` filtered by `restaurant_id`, so a
  // guest who has only ever booked elsewhere can never appear in the result
  // set, by construction of the query rather than a runtime check.

  test('half-full violation is rejected, no booking written', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()

    try {
      await signInAsTestOwner(page)
      await page.goto('/dashboard/bookings?walkin=1')

      await page.locator('[data-testid="walkin-name"]').fill('X')
      await page.locator('[data-testid="walkin-party"]').fill('1')
      await page.locator(`[data-testid="walkin-zone"]`).selectOption(TEST_RESTAURANT_ZONE_ID)
      await page.locator(`[data-testid="walkin-table-${TEST_RESTAURANT_TABLE_ID}"]`).check()
      await page.locator('[data-testid="walkin-submit"]').click()

      await expect(page.locator('[data-testid="walkin-error"]')).toContainText(
        'Te veel plek voor het aantal gasten',
        { timeout: 15_000 },
      )

      const booking = await getWalkInBooking()
      expect(booking).toBeNull()
    } finally {
      await wipeTestRestaurant()
    }
  })

  test('table conflict is rejected, no booking written', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()

    const occupying = await seedBookingForAction({
      restaurantId: TEST_RESTAURANT_ID,
      slotTime: new Date(Date.now() - 30 * 60_000),
      status: 'attended',
      partySize: 2,
      durationMinutes: 90,
      zoneId: TEST_RESTAURANT_ZONE_ID,
      tableIds: [TEST_RESTAURANT_TABLE_ID],
    })

    try {
      await signInAsTestOwner(page)
      await page.goto('/dashboard/bookings?walkin=1')

      await page.locator('[data-testid="walkin-name"]').fill('X')
      await page.locator('[data-testid="walkin-party"]').fill('2')
      await page.locator(`[data-testid="walkin-zone"]`).selectOption(TEST_RESTAURANT_ZONE_ID)
      await page.locator(`[data-testid="walkin-table-${TEST_RESTAURANT_TABLE_ID}"]`).check()
      await page.locator('[data-testid="walkin-submit"]').click()

      await expect(page.locator('[data-testid="walkin-error"]')).toContainText(
        'Een van deze tafels is al bezet.',
        { timeout: 15_000 },
      )

      const supabase = adminClient()
      const { data: bookings } = await supabase
        .from('bookings')
        .select('id')
        .eq('restaurant_id', TEST_RESTAURANT_ID)
        .eq('source', 'walk_in')
      expect(bookings?.length ?? 0).toBe(0)
    } finally {
      await wipeTestRestaurant()
      await cleanupSeededBookingDetail(occupying.guestId)
    }
  })

  test('form UX pre-check: half-full hint, submit gating, cancel clears param', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()

    try {
      await signInAsTestOwner(page)
      await page.goto('/dashboard/bookings?walkin=1')

      const dialog = page.getByRole('dialog', { name: 'Walk-in toevoegen' })
      await expect(dialog).toBeVisible()

      const submit = page.locator('[data-testid="walkin-submit"]')
      await expect(submit).toBeDisabled()

      await page.locator('[data-testid="walkin-party"]').fill('1')
      await page.locator(`[data-testid="walkin-zone"]`).selectOption(TEST_RESTAURANT_ZONE_ID)
      await page.locator(`[data-testid="walkin-table-${TEST_RESTAURANT_TABLE_ID}"]`).check()
      // 4-seat table, party 1: too much room (4 > 1*2). This is a UX hint
      // only — the server is the real authority — so it does NOT gate submit.
      await expect(page.getByText('Te veel plek — kies andere tafels', { exact: true })).toBeVisible()
      await expect(submit).toBeDisabled() // still no name

      await page.locator('[data-testid="walkin-name"]').fill('X')
      await expect(submit).toBeEnabled() // name + zone + table present, even though the hint still warns

      await page.locator('[data-testid="walkin-party"]').fill('2')
      // 4-seat table, party 2: exactly half-full (4 <= 2*2, 4 >= 2) -> "2 plaatsen over"
      await expect(page.getByText('2 plaatsen over', { exact: true })).toBeVisible()
      await expect(submit).toBeEnabled()

      await page.locator('[data-testid="walkin-name"]').fill('')
      await expect(submit).toBeDisabled()
      await page.locator('[data-testid="walkin-name"]').fill('X')
      await expect(submit).toBeEnabled()

      await page.getByRole('button', { name: 'Annuleren' }).click()
      await expect(dialog).toHaveCount(0)
      await expect(page).toHaveURL(/^(?!.*walkin=1).*$/)
    } finally {
      await wipeTestRestaurant()
    }
  })
})
