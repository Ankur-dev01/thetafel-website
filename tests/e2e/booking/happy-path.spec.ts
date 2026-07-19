import { test, expect } from '../fixtures/base'
import type { Page } from '@playwright/test'
import { switchToEnglish } from '../fixtures/locale'
import {
  adminClient,
  wipeTestRestaurant,
  TEST_RESTAURANT_ID,
  TEST_RESTAURANT_SLUG,
} from '../fixtures/test-restaurant'

// The booking wizard (BookingFlowProvider, lib/booking/state.tsx) is a
// single URL with client-side steps, not a route per step. For the
// _e2e_test_restaurant fixture (one zone, no deposit config) the visible
// steps are R1 (date+party) -> R2 (slot) -> R4 (guest details) -> R6
// (review+confirm) — R3 (zone choice) and R5 (deposit) are skipped because
// there's only one zone and noshow_prepaid_enabled is false. "Step X of 4"
// on screen reflects that 4-step visible set, not the raw R1..R6 numbering.

test.describe('booking happy path', () => {
  test.afterEach(async () => {
    await wipeTestRestaurant()
  })

  test('books a table in Dutch — full happy path', async ({ page, testRunId }) => {
    const email = `e2e-booking-happy-${testRunId}@e2e.thetafel.invalid`

    await page.goto(`/r/${TEST_RESTAURANT_SLUG}/book`)
    await expect(page.getByRole('heading', { name: 'Reserveer een tafel' })).toBeVisible()

    await selectDateAndParty(page, 'nl', 2)
    await page.getByRole('button', { name: 'Doorgaan' }).click()

    await selectSlot(page)
    await page.getByRole('button', { name: 'Doorgaan' }).click()

    await page.getByRole('textbox', { name: 'Naam' }).fill('Jan de Vries')
    await page.getByRole('textbox', { name: 'E-mailadres' }).fill(email)
    await page.getByRole('textbox', { name: 'Telefoonnummer' }).fill('+31 6 12345678')
    await page.getByRole('button', { name: 'Doorgaan' }).click()

    await page.getByRole('button', { name: 'Bevestig reservering' }).click()

    await page.waitForURL(/\/book\/confirmed\?ref=/)
    await expect(page.getByRole('heading', { name: 'Je reservering is bevestigd' })).toBeVisible()

    const bookingRef = new URL(page.url()).searchParams.get('ref')
    expect(bookingRef).toMatch(/^TFL-/)

    const supabase = adminClient()
    const { data: bookings } = await supabase
      .from('bookings')
      .select('id, party_size, status, slot_time, guest_id, magic_link_token_hash')
      .eq('restaurant_id', TEST_RESTAURANT_ID)
      .eq('booking_ref', bookingRef!)
    expect(bookings).toHaveLength(1)
    const booking = bookings![0]

    expect(booking.party_size).toBe(2)
    // createBooking.ts always inserts status: 'confirmed' — there is no
    // 'pending' state in this flow (unlike the deposit flow, out of scope
    // here per C9.1 narrowing).
    expect(booking.status).toBe('confirmed')
    expect(booking.magic_link_token_hash).toBeTruthy()

    const { data: guest } = await supabase
      .from('guests')
      .select('full_name, email_lower, phone')
      .eq('id', booking.guest_id)
      .single()
    expect(guest?.email_lower).toBe(email.toLowerCase())
    expect(guest?.full_name).toBe('Jan de Vries')
    // normalizePhone (lib/consumer/sanitize.ts) strips spaces and keeps the
    // leading +, so "+31 6 12345678" becomes E.164 "+31612345678".
    expect(guest?.phone).toBe('+31612345678')

    const { data: auditRows } = await supabase
      .from('consumer_audit_logs')
      .select('event_type')
      .eq('booking_id', booking.id)
      .eq('event_type', 'booking.create.succeeded')
    expect(auditRows).toHaveLength(1)
  })

  test('locale toggle mid-flow restarts the wizard, but booking completes in English', async ({
    page,
    testRunId,
  }) => {
    const email = `e2e-booking-locale-${testRunId}@e2e.thetafel.invalid`

    await page.goto(`/r/${TEST_RESTAURANT_SLUG}/book`)

    // Get partway through the Dutch flow first...
    await selectDateAndParty(page, 'nl', 2)
    await page.getByRole('button', { name: 'Doorgaan' }).click()
    await expect(page.getByText('Stap 2 van 4')).toBeVisible()

    // ...then toggle locale. The toggle (components/layout/Nav.tsx) does a
    // full router.push to a different localized route, which remounts
    // BookingFlowProvider — client state (step, draft) is in-memory only
    // and is NOT preserved across the navigation. This resets the wizard
    // back to step 1, in English. That's a real, observed behavior, not a
    // bug this test is asserting shouldn't exist — just documenting it.
    await switchToEnglish(page)
    await expect(page).toHaveURL(/\/en\/r\//)
    await expect(page.getByRole('heading', { name: 'Reserve a table' })).toBeVisible()
    await expect(page.getByText('Step 1 of 4')).toBeVisible()

    // Complete the booking from scratch, in English.
    await selectDateAndParty(page, 'en', 2)
    await page.getByRole('button', { name: 'Continue' }).click()

    await selectSlot(page)
    await page.getByRole('button', { name: 'Continue' }).click()

    await page.getByRole('textbox', { name: 'Name' }).fill('Jan de Vries')
    await page.getByRole('textbox', { name: 'Email address' }).fill(email)
    await page.getByRole('textbox', { name: 'Phone number' }).fill('+31 6 12345678')
    await page.getByRole('button', { name: 'Continue' }).click()

    await page.getByRole('button', { name: 'Confirm reservation' }).click()

    await page.waitForURL(/\/en\/r\/.*\/book\/confirmed\?ref=/)
    await expect(page.getByRole('heading', { name: "You're booked in" })).toBeVisible()

    const bookingRef = new URL(page.url()).searchParams.get('ref')
    expect(bookingRef).toMatch(/^TFL-/)

    // bookings has no locale column (confirmed against the applied schema —
    // TheTafel_Consumer_Schema_v1_0.sql — so there's nothing to assert there
    // beyond "the row exists").
    const supabase = adminClient()
    const { data: bookings } = await supabase
      .from('bookings')
      .select('id, party_size, status')
      .eq('restaurant_id', TEST_RESTAURANT_ID)
      .eq('booking_ref', bookingRef!)
    expect(bookings).toHaveLength(1)
    expect(bookings![0].party_size).toBe(2)
    expect(bookings![0].status).toBe('confirmed')
  })
})

/* -------------------------------------------------------------------------- */
/*  Helpers — booking-flow-specific, not shared fixtures                     */
/* -------------------------------------------------------------------------- */

/**
 * Picks a date 3 days out (Europe/Amsterdam) and a party size on step R1.
 * Advances months via the "next month" button until the calendar shows the
 * target month — mirrors DatePicker's own Intl-based month label so it
 * still works if the target date crosses a month boundary.
 */
async function selectDateAndParty(page: Page, locale: 'nl' | 'en', partySize: number): Promise<void> {
  const target = daysFromNowInAmsterdam(3)
  const targetMonthLabel = new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
  }).format(new Date(Date.UTC(target.year, target.month - 1, 1)))

  const nextMonthLabel = locale === 'nl' ? 'Volgende maand' : 'Next month'
  for (let i = 0; i < 12; i++) {
    const visible = await page.getByText(targetMonthLabel, { exact: true }).isVisible().catch(() => false)
    if (visible) break
    await page.getByRole('button', { name: nextMonthLabel }).click()
  }

  // Day-of-month buttons and party-size buttons both use plain numbers
  // (1-31 vs 1-8) with no distinguishing role/testid, and both sections are
  // visible on screen at once (StepR1 renders date + party size together).
  // If the target date falls in a fully-future month, days 1-8 become
  // buttons too — colliding with party-size lookups by number. Scope each
  // lookup to its own heading's parent section to avoid that.
  const dateHeading = locale === 'nl' ? 'Kies een datum' : 'Pick a date'
  const partyHeading = locale === 'nl' ? 'Met hoeveel mensen?' : 'How many people?'
  const dateSection = page.getByRole('heading', { name: dateHeading }).locator('..')
  const partySection = page.getByRole('heading', { name: partyHeading }).locator('..')

  await dateSection.getByRole('button', { name: String(target.day), exact: true }).click()
  await partySection.getByRole('button', { name: String(partySize), exact: true }).click()
}

/**
 * Picks the 19:00 dinner slot on step R2. Slot buttons' accessible name is
 * "{time} {low-capacity hint}" when remainingTables is below the hint
 * threshold (SlotGrid.tsx) — the test restaurant has exactly one table, so
 * the hint always renders. Matching on a leading-time regex avoids coupling
 * to that hint's exact wording.
 */
async function selectSlot(page: Page): Promise<void> {
  const slot = page.getByRole('button', { name: /^19:00/ })
  await expect(slot).toBeVisible()
  await slot.click()
}

function daysFromNowInAmsterdam(days: number): { year: number; month: number; day: number } {
  const todayLocal = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  const [y, m, d] = todayLocal.split('-').map(Number)
  const future = new Date(Date.UTC(y, m - 1, d + days))
  return { year: future.getUTCFullYear(), month: future.getUTCMonth() + 1, day: future.getUTCDate() }
}
