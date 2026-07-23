import { randomUUID } from 'node:crypto'
import { test, expect } from '../fixtures/base'
import {
  wipeTestRestaurant,
  adminClient,
  TEST_RESTAURANT_ID,
  TEST_RESTAURANT_SLUG,
  TEST_RESTAURANT_TABLE_ID,
} from '../fixtures/test-restaurant'
import { signInAsTestOwner } from '../fixtures/dashboard-auth'

async function resetPauseFields() {
  const supabase = adminClient()
  await supabase
    .from('restaurants')
    .update({ paused_at: null, paused_by: null, pause_reason: null, grace_period_started_at: null })
    .eq('id', TEST_RESTAURANT_ID)
}

async function setPaused(reason: 'manual' | 'billing_suspended' = 'manual') {
  const supabase = adminClient()
  await supabase
    .from('restaurants')
    .update({ paused_at: new Date().toISOString(), pause_reason: reason })
    .eq('id', TEST_RESTAURANT_ID)
}

test.describe('Pause / resume flow (D1.3)', () => {
  test('pause via settings UI shows dashboard banner; resume clears it', async ({ page }) => {
    // The Vandaag page's router.refresh() re-runs getTodayPayload's parallel
    // queries (bookings/orders/tabs/6 alert checks) — that consistently
    // takes ~5-6.5s, right at the default assertion timeout's edge. Give
    // both the assertion and the overall test enough room.
    test.setTimeout(60_000)
    await wipeTestRestaurant()
    await resetPauseFields()
    await signInAsTestOwner(page)

    await page.goto('/dashboard/settings')
    await expect(page.getByRole('heading', { name: 'Restaurant is live' })).toBeVisible()
    const pauseButton = page.getByRole('button', { name: 'Pauzeer restaurant' })
    await expect(pauseButton).toBeVisible()

    await pauseButton.click()
    await expect(page.getByRole('heading', { name: 'Weet je het zeker?' })).toBeVisible()
    await page.getByRole('button', { name: 'Ja, pauzeer' }).click()

    await expect(page.getByText(/Restaurant is gepauzeerd sinds/)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Hervat restaurant' })).toBeVisible()

    const supabase = adminClient()
    const { data: afterPause } = await supabase
      .from('restaurants')
      .select('paused_at, pause_reason, paused_by')
      .eq('id', TEST_RESTAURANT_ID)
      .single()
    expect(afterPause?.paused_at).not.toBeNull()
    expect(afterPause?.pause_reason).toBe('manual')
    expect(afterPause?.paused_by).not.toBeNull()

    const { count: pausedAuditCount } = await supabase
      .from('dashboard_audit_logs')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', TEST_RESTAURANT_ID)
      .eq('event_type', 'restaurant.paused')
    expect(pausedAuditCount).toBeGreaterThanOrEqual(1)

    await page.goto('/dashboard')
    await expect(page.getByText('Deze locatie is gepauzeerd.')).toBeVisible()
    const resumeButton = page.getByRole('button', { name: 'Hervatten' })
    await expect(resumeButton).toBeVisible()

    await resumeButton.click()
    await expect(page.getByText('Deze locatie is gepauzeerd.')).toHaveCount(0, { timeout: 15_000 })
    await expect(page.getByText('Live', { exact: true })).toBeVisible()

    const { data: afterResume } = await supabase
      .from('restaurants')
      .select('paused_at')
      .eq('id', TEST_RESTAURANT_ID)
      .single()
    expect(afterResume?.paused_at).toBeNull()

    const { count: resumedAuditCount } = await supabase
      .from('dashboard_audit_logs')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', TEST_RESTAURANT_ID)
      .eq('event_type', 'restaurant.resumed')
    expect(resumedAuditCount).toBeGreaterThanOrEqual(1)

    await resetPauseFields()
    await wipeTestRestaurant()
  })

  test('consumer surfaces respect the pause', async ({ browser }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()
    await resetPauseFields()
    await setPaused('manual')

    try {
      const context = await browser.newContext()
      const page = await context.newPage()

      await page.goto(`/r/${TEST_RESTAURANT_SLUG}/book`)
      await expect(page.getByText('Deze locatie is op dit moment niet beschikbaar. Kom binnenkort terug.')).toBeVisible()
      await expect(page.getByRole('button', { name: /reserveer/i })).toHaveCount(0)

      const bookingRes = await page.request.post('/api/consumer/bookings/create', {
        data: {
          slug: TEST_RESTAURANT_SLUG,
          partySize: 2,
          date: '2026-08-01',
          slotInstant: new Date(Date.now() + 24 * 3600_000).toISOString(),
          zoneId: null,
          selectedSlotZoneIds: [randomUUID()],
          guest: { name: 'Test Guest', email: 'e2e-pause@thetafel.test', phone: '+31600000003' },
          allergies: '',
          occasion: '',
          requests: '',
          marketingConsent: false,
          locale: 'nl',
          turnstileToken: 'dev-bypass',
          idempotencyKey: randomUUID(),
        },
      })
      const bookingBody = await bookingRes.json()
      expect(bookingBody.code).toBe('paused')

      const orderRes = await page.request.post(`/api/v1/public/${TEST_RESTAURANT_SLUG}/order`, {
        data: {
          slug: TEST_RESTAURANT_SLUG,
          tableId: TEST_RESTAURANT_TABLE_ID,
          payMode: 'pay_at_table',
          locale: 'nl',
          lines: [{ menuItemId: randomUUID(), quantity: 1 }],
          idempotencyKey: randomUUID(),
          turnstileToken: 'dev-bypass',
        },
      })
      expect(orderRes.status()).toBe(503)
      const orderBody = await orderRes.json()
      expect(orderBody.code).toBe('paused')

      await resetPauseFields()

      const bookingRes2 = await page.request.post('/api/consumer/bookings/create', {
        data: {
          slug: TEST_RESTAURANT_SLUG,
          partySize: 2,
          date: '2026-08-01',
          slotInstant: new Date(Date.now() + 24 * 3600_000).toISOString(),
          zoneId: null,
          selectedSlotZoneIds: [randomUUID()],
          guest: { name: 'Test Guest', email: 'e2e-pause@thetafel.test', phone: '+31600000003' },
          allergies: '',
          occasion: '',
          requests: '',
          marketingConsent: false,
          locale: 'nl',
          turnstileToken: 'dev-bypass',
          idempotencyKey: randomUUID(),
        },
      })
      const bookingBody2 = await bookingRes2.json()
      expect(bookingBody2.code).not.toBe('paused')

      await context.close()
    } finally {
      await resetPauseFields()
      await wipeTestRestaurant()
      // bookingRes2's guest uses @thetafel.test (like seed-today/seed-alerts),
      // which wipeTestRestaurant's anonymisation pattern doesn't match.
      await adminClient().from('guests').delete().eq('email_lower', 'e2e-pause@thetafel.test')
    }
  })

  test('monotonic guards reject double pause / double resume', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()
    await resetPauseFields()
    await signInAsTestOwner(page)

    const pause1 = await page.request.post('/api/dashboard/restaurant/pause')
    expect(pause1.ok()).toBeTruthy()

    const pause2 = await page.request.post('/api/dashboard/restaurant/pause')
    expect(pause2.status()).toBe(409)
    expect((await pause2.json()).error).toBe('already_paused')

    const resume1 = await page.request.post('/api/dashboard/restaurant/resume')
    expect(resume1.ok()).toBeTruthy()

    const resume2 = await page.request.post('/api/dashboard/restaurant/resume')
    expect(resume2.status()).toBe(409)
    expect((await resume2.json()).error).toBe('not_paused')

    await resetPauseFields()
    await wipeTestRestaurant()
  })

  test('billing-suspended state gates resume', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()
    await resetPauseFields()
    await setPaused('billing_suspended')
    await signInAsTestOwner(page)

    await page.goto('/dashboard/settings')
    await expect(page.getByRole('heading', { name: 'Restaurant is gepauzeerd wegens facturatie' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Hervat restaurant' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Naar facturatie' })).toBeVisible()

    const resumeRes = await page.request.post('/api/dashboard/restaurant/resume')
    expect(resumeRes.status()).toBe(409)
    expect((await resumeRes.json()).error).toBe('billing_suspended')

    await page.goto('/dashboard')
    await expect(
      page.getByText('Deze locatie is gepauzeerd wegens openstaande facturatie.')
    ).toBeVisible()

    await resetPauseFields()
    await wipeTestRestaurant()
  })

  test('dashboard stays usable while paused', async ({ page }) => {
    test.setTimeout(60_000)
    await wipeTestRestaurant()
    await resetPauseFields()
    await setPaused('manual')
    await signInAsTestOwner(page)

    for (const path of ['/dashboard', '/dashboard/bookings', '/dashboard/orders', '/dashboard/tabs', '/dashboard/settings']) {
      await page.goto(path)
      await expect(page).toHaveURL(new RegExp(path.replace(/\//g, '\\/') + '$'))
    }

    await page.goto('/dashboard')
    await expect(page.getByText('Deze locatie is gepauzeerd.')).toBeVisible()
    await expect(page.getByText('Gepauzeerd', { exact: true })).toBeVisible()

    await resetPauseFields()
    await wipeTestRestaurant()
  })
})
