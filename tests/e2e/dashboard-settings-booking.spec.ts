import { test, expect } from './fixtures/base'
import { adminClient, TEST_RESTAURANT_ID } from './fixtures/test-restaurant'
import { signInAsTestOwner } from './fixtures/dashboard-auth'
import { getBookingRules, resetTestRestaurantBookingRules } from './fixtures/resetTestRestaurantBookingRules'

// A real restaurant id from the same table — used only to prove the route
// never touches anything but the caller's own restaurant. Never written to.
const OTHER_RESTAURANT_ID = '288b0437-81da-4089-98e4-d89227a98004'

async function setMollieVerified(): Promise<void> {
  const { error } = await adminClient()
    .from('restaurants')
    .update({
      mollie_status: 'verified',
      mollie_access_token: 'e2e-fake-token',
      mollie_token_expires_at: new Date(Date.now() + 60 * 60_000).toISOString(),
    })
    .eq('id', TEST_RESTAURANT_ID)
  if (error) throw new Error(`setMollieVerified failed: ${error.message}`)
}

async function restoreMollieNotStarted(): Promise<void> {
  const { error } = await adminClient()
    .from('restaurants')
    .update({ mollie_status: 'not_started', mollie_access_token: null, mollie_token_expires_at: null })
    .eq('id', TEST_RESTAURANT_ID)
  if (error) throw new Error(`restoreMollieNotStarted failed: ${error.message}`)
}

test.describe('Settings — booking rules editor (D5.3)', () => {
  // Each test starts from the canonical seed — T2 (and any other test that
  // mutates prepaid/mollie state) must not leak into a later test's initial
  // load. Discovered the hard way: T2 left noshow_prepaid_enabled=true after
  // restoring Mollie to not_started in its own finally block, which made
  // T8's freshly-loaded page permanently invalid (prepaid on with no
  // verified Mollie) and its Save button never enabled.
  test.beforeEach(async () => {
    await resetTestRestaurantBookingRules()
  })


  test('T1: load reflects current values', async ({ page }) => {
    await signInAsTestOwner(page)
    await page.goto('/dashboard/settings/booking')

    await expect(page.locator('[data-testid="booking-min-lead-time"]')).toHaveValue('60')
    await expect(page.locator('[data-testid="booking-max-party-size"]')).toHaveValue('8')
    await expect(page.locator('[data-testid="booking-window-days"]')).toHaveValue('90')
    await expect(page.locator('[data-testid="booking-max-guests-per-slot-none"]')).toBeChecked()
    await expect(page.locator('[data-testid="booking-waitlist-enabled"]')).toBeChecked()
    await expect(page.locator('[data-testid="booking-zone-choice-enabled"]')).toBeChecked()
    await expect(page.locator('[data-testid="booking-noshow-email"]')).toBeChecked()
    await expect(page.locator('[data-testid="booking-noshow-whatsapp"]')).not.toBeChecked()
    await expect(page.locator('[data-testid="booking-noshow-reconfirmation"]')).not.toBeChecked()
    await expect(page.locator('[data-testid="booking-noshow-prepaid"]')).not.toBeChecked()
    await expect(page.locator('[data-testid="booking-template-nl-textarea"]')).toContainText('{restaurant}')
    await expect(page.locator('[data-testid="booking-question-allergies"]')).toBeChecked()
  })

  test('T2: change a value in each section, save, reload, persists', async ({ page }) => {
    await setMollieVerified()
    try {
      await signInAsTestOwner(page)
      await page.goto('/dashboard/settings/booking')

      await page.locator('[data-testid="booking-min-lead-time"]').selectOption('120')
      await page.locator('[data-testid="booking-noshow-prepaid"]').check()
      await page.locator('[data-testid="booking-prepaid-amount"]').fill('5.00')
      await page.locator('[data-testid="booking-prepaid-threshold"]').selectOption('4')
      await page.locator('[data-testid="booking-template-nl-textarea"]').fill('Hallo {naam}, tot ziens bij {restaurant}!')
      await page.locator('[data-testid="booking-question-occasion"]').uncheck()

      await expect(page.locator('[data-testid="booking-save"]')).toBeEnabled()
      await page.locator('[data-testid="booking-save"]').click()
      await expect(page.locator('[data-testid="booking-saved-toast"]')).toBeVisible()

      await page.reload()
      await expect(page.locator('[data-testid="booking-min-lead-time"]')).toHaveValue('120')
      await expect(page.locator('[data-testid="booking-noshow-prepaid"]')).toBeChecked()
      await expect(page.locator('[data-testid="booking-prepaid-amount"]')).toHaveValue('5.00')
      await expect(page.locator('[data-testid="booking-question-occasion"]')).not.toBeChecked()

      const row = await getBookingRules()
      expect(row.min_lead_time_minutes).toBe(120)
      expect(row.noshow_prepaid_enabled).toBe(true)
      expect(row.noshow_prepaid_amount_cents).toBe(500)
      expect(row.noshow_prepaid_threshold).toBe(4)
      expect(row.confirmation_template_nl).toBe('Hallo {naam}, tot ziens bij {restaurant}!')
      expect(row.booking_question_occasion).toBe(false)
    } finally {
      await restoreMollieNotStarted()
    }
  })

  test('T3: validation errors block save (direct route POST)', async ({ page }) => {
    await signInAsTestOwner(page)

    const base = {
      min_lead_time_minutes: 60,
      max_party_size_online: 8,
      booking_window_days: 90,
      max_guests_per_slot: null,
      waitlist_enabled: true,
      guest_zone_choice_enabled: true,
      noshow_reminders_email_enabled: true,
      noshow_reminders_whatsapp_enabled: false,
      noshow_reconfirmation_enabled: false,
      noshow_prepaid_enabled: false,
      noshow_prepaid_amount_cents: null,
      noshow_prepaid_threshold: null,
      confirmation_template_nl: 'Bedankt {naam}, tot ziens bij {restaurant}.',
      confirmation_template_en: 'Thanks {naam}, see you at {restaurant}.',
      booking_question_allergies: true,
      booking_question_occasion: true,
      booking_question_requests: true,
    }

    // max_party_size_online not a valid enum value
    let res = await page.request.post('/api/dashboard/settings/booking', { data: { ...base, max_party_size_online: 1 } })
    expect(res.status()).toBe(400)
    expect((await res.json()).code).toBe('validation_error')

    // booking_window_days below the minimum
    res = await page.request.post('/api/dashboard/settings/booking', { data: { ...base, booking_window_days: 0 } })
    expect(res.status()).toBe(400)
    expect((await res.json()).code).toBe('validation_error')

    // prepaid on with an amount under €1
    res = await page.request.post('/api/dashboard/settings/booking', {
      data: { ...base, noshow_prepaid_enabled: true, noshow_prepaid_amount_cents: 50, noshow_prepaid_threshold: 1 },
    })
    expect(res.status()).toBe(400)

    // NL template missing {restaurant}
    res = await page.request.post('/api/dashboard/settings/booking', {
      data: { ...base, confirmation_template_nl: 'No placeholder here.' },
    })
    expect(res.status()).toBe(400)
    expect((await res.json()).code).toBe('template_missing_restaurant')

    // Unknown placeholder
    res = await page.request.post('/api/dashboard/settings/booking', {
      data: { ...base, confirmation_template_nl: 'Bedankt {foo}, tot ziens bij {restaurant}.' },
    })
    expect(res.status()).toBe(400)
    expect((await res.json()).code).toBe('template_unknown_placeholder')

    // waitlist_enabled not boolean
    res = await page.request.post('/api/dashboard/settings/booking', { data: { ...base, waitlist_enabled: 'yes' } })
    expect(res.status()).toBe(400)
    expect((await res.json()).code).toBe('invalid_body')
  })

  test('T4: WhatsApp reminders toggle disabled on non-Premium tier', async ({ page }) => {
    await signInAsTestOwner(page)
    await page.goto('/dashboard/settings/booking')

    // Test restaurant's subscription_tier is null (non-Premium) by default.
    await expect(page.locator('[data-testid="booking-noshow-whatsapp"]')).toBeDisabled()
    await expect(page.locator('[data-testid="booking-noshow-whatsapp-premium-note"]')).toBeVisible()
  })

  test('T5: prepaid toggle disabled when Mollie is not verified', async ({ page }) => {
    await signInAsTestOwner(page)
    await page.goto('/dashboard/settings/booking')

    // Test restaurant's mollie_status is 'not_started' by default.
    await expect(page.locator('[data-testid="booking-noshow-prepaid"]')).toBeDisabled()
    await expect(page.locator('[data-testid="booking-noshow-prepaid-mollie-note"]')).toBeVisible()
  })

  test('T6: server rejects WhatsApp reminders on starter tier even via direct POST', async ({ page }) => {
    await signInAsTestOwner(page)

    const res = await page.request.post('/api/dashboard/settings/booking', {
      data: {
        min_lead_time_minutes: 60,
        max_party_size_online: 8,
        booking_window_days: 90,
        max_guests_per_slot: null,
        waitlist_enabled: true,
        guest_zone_choice_enabled: true,
        noshow_reminders_email_enabled: true,
        noshow_reminders_whatsapp_enabled: true,
        noshow_reconfirmation_enabled: false,
        noshow_prepaid_enabled: false,
        noshow_prepaid_amount_cents: null,
        noshow_prepaid_threshold: null,
        confirmation_template_nl: 'Bedankt {naam}, tot ziens bij {restaurant}.',
        confirmation_template_en: 'Thanks {naam}, see you at {restaurant}.',
        booking_question_allergies: true,
        booking_question_occasion: true,
        booking_question_requests: true,
      },
    })
    expect(res.status()).toBe(400)
    expect((await res.json()).code).toBe('whatsapp_needs_premium')

    const row = await getBookingRules()
    expect(row.noshow_reminders_whatsapp_enabled).toBe(false)
  })

  test.skip('T7: rate limit fires (unreachable in dev-mode e2e — see D5.1/D5.2 rationale)', async () => {})

  test('T8: cross-restaurant safety', async ({ page }) => {
    const { data: before } = await adminClient()
      .from('restaurants')
      .select(
        'min_lead_time_minutes, max_party_size_online, booking_window_days, noshow_prepaid_enabled, confirmation_template_nl',
      )
      .eq('id', OTHER_RESTAURANT_ID)
      .single()

    await signInAsTestOwner(page)
    await page.goto('/dashboard/settings/booking')
    await page.locator('[data-testid="booking-min-lead-time"]').selectOption('240')
    await page.locator('[data-testid="booking-save"]').click()
    await expect(page.locator('[data-testid="booking-saved-toast"]')).toBeVisible()

    const { data: after } = await adminClient()
      .from('restaurants')
      .select(
        'min_lead_time_minutes, max_party_size_online, booking_window_days, noshow_prepaid_enabled, confirmation_template_nl',
      )
      .eq('id', OTHER_RESTAURANT_ID)
      .single()
    expect(after).toEqual(before)
  })

  test('T9: audit row carries fields_changed only, no template text', async ({ page }) => {
    await signInAsTestOwner(page)
    await page.goto('/dashboard/settings/booking')

    await page.locator('[data-testid="booking-min-lead-time"]').selectOption('30')
    await page.locator('[data-testid="booking-template-en-textarea"]').fill(
      'Sensitive guest data should never appear in an audit log, {restaurant}.',
    )
    await page.locator('[data-testid="booking-save"]').click()
    await expect(page.locator('[data-testid="booking-saved-toast"]')).toBeVisible()

    const { data: rows } = await adminClient()
      .from('dashboard_audit_logs')
      .select('*')
      .eq('restaurant_id', TEST_RESTAURANT_ID)
      .eq('event_type', 'settings.booking.edit')
      .order('created_at', { ascending: false })
      .limit(1)

    const audit = rows?.[0]
    expect(audit).toBeTruthy()
    const fieldsChanged = audit.event_data.fields_changed as string[]
    expect(fieldsChanged).toContain('min_lead_time_minutes')
    expect(fieldsChanged).toContain('confirmation_template_en')

    const serialized = JSON.stringify(audit.event_data)
    expect(serialized).not.toContain('Sensitive guest data')
  })
})
