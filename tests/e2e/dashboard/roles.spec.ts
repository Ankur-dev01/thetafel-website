import { test, expect } from '../fixtures/base'
import { playwrightBaseUrl } from '../fixtures/baseUrl'
import {
  TEST_RESTAURANT_ID,
  TEST_RESTAURANT_ZONE_ID,
  TEST_RESTAURANT_TABLE_ID,
  wipeTestRestaurant,
  adminClient,
} from '../fixtures/test-restaurant'
import { ensureRoleAccounts, signInAs, setRoleActive } from '../fixtures/role-accounts'
import { seedBookingForAction, cleanupSeededBookingDetail } from '../fixtures/seed-booking-detail'
import { seedOrders, cleanupSeededOrderGuests } from '../fixtures/seed-orders'
import { resetTestRestaurantBookingRules } from '../fixtures/resetTestRestaurantBookingRules'
import type { Page, PlaywrightWorkerArgs } from '@playwright/test'

// D8.4 — role test matrix. Every case asserts BOTH what a role can do and what
// it cannot: hidden navigation, a redirect when the URL is visited directly, and
// a 403 from the API when called directly. Accounts are real staff on the e2e
// restaurant, provisioned through the real invite flow (fixtures/role-accounts).

const ANY_UUID = '00000000-0000-0000-0000-000000000000'
const SHOTS = 'test-results/roles'

async function provision(playwright: PlaywrightWorkerArgs['playwright']) {
  const ctx = await playwright.request.newContext({ baseURL: playwrightBaseUrl() })
  try {
    await ensureRoleAccounts(ctx)
  } finally {
    await ctx.dispose()
  }
}

/** Visiting `path` directly must bounce to `expected` (a locale-less path). */
async function expectRedirect(page: Page, path: string, expected: string) {
  await page.goto(path)
  await expect(page).toHaveURL(new RegExp(`${expected.replace(/\//g, '\\/')}$`))
}

const bookingRules = {
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

test.describe('Role matrix (D8.4)', () => {
  test.beforeAll(async ({ playwright }) => {
    test.setTimeout(120_000)
    await provision(playwright)
  })

  test.describe('manager', () => {
    test('sees settings, not billing; can edit booking rules; invite limits', async ({ page }) => {
      test.setTimeout(120_000)
      await signInAs(page, 'manager')

      // — allowed —
      await page.goto('/dashboard/settings')
      await expect(page.locator('a[href="/dashboard/settings/booking"]')).toBeVisible()
      await expect(page.locator('a[href="/dashboard/settings/staff"]')).toBeVisible()
      await page.screenshot({ path: `${SHOTS}/manager-settings.png`, fullPage: true })
      // — hidden —
      for (const hidden of ['billing', 'payments', 'business']) {
        await expect(page.locator(`a[href="/dashboard/settings/${hidden}"]`)).toHaveCount(0)
      }

      const save = await page.request.post('/api/dashboard/settings/booking', { data: bookingRules })
      expect(save.status()).toBe(200)
      await resetTestRestaurantBookingRules()

      // — direct URL: redirect —
      await expectRedirect(page, '/dashboard/settings/billing', '/dashboard')
      await expectRedirect(page, '/dashboard/settings/payments', '/dashboard')
      await expectRedirect(page, '/dashboard/settings/business', '/dashboard')

      // — direct API: 403 —
      expect((await page.request.post('/api/dashboard/billing/cancel', { data: { reason: 'too_expensive' } })).status()).toBe(403)
      expect((await page.request.post('/api/dashboard/business', { data: {} })).status()).toBe(403)

      // Team: a manager may invite service/kitchen but not manager/owner.
      const refused = await page.request.post('/api/dashboard/staff/invite', {
        data: { email: 'e2e-role-check@e2e.thetafel.invalid', role: 'manager' },
      })
      expect(refused.status()).toBe(403)
      expect((await refused.json()).code).toBe('role_not_allowed')
      const refusedOwner = await page.request.post('/api/dashboard/staff/invite', {
        data: { email: 'e2e-role-check@e2e.thetafel.invalid', role: 'owner' },
      })
      expect([400, 403]).toContain(refusedOwner.status())

      const ok = await page.request.post('/api/dashboard/staff/invite', {
        data: { email: 'e2e-role-check@e2e.thetafel.invalid', role: 'service' },
      })
      expect(ok.status()).toBe(200)
      await adminClient().from('staff_invites').delete().eq('restaurant_id', TEST_RESTAURANT_ID).eq('email_lower', 'e2e-role-check@e2e.thetafel.invalid')

      // Managers never manage the owner.
      const { data: owner } = await adminClient()
        .from('restaurant_staff')
        .select('id')
        .eq('restaurant_id', TEST_RESTAURANT_ID)
        .eq('role', 'owner')
        .maybeSingle()
      const ownerId = owner?.id as string
      expect((await page.request.post('/api/dashboard/staff/member', { data: { memberId: ownerId, action: 'deactivate' } })).status()).toBe(403)
      expect((await page.request.post('/api/dashboard/staff/member', { data: { memberId: ownerId, action: 'role', role: 'service' } })).status()).toBe(403)
    })
  })

  test.describe('service', () => {
    test('front-of-house only: acts on bookings, nothing else', async ({ page }) => {
      test.setTimeout(90_000)
      await wipeTestRestaurant()
      const seeded = await seedBookingForAction({
        restaurantId: TEST_RESTAURANT_ID,
        slotTime: new Date(Date.now() - 5 * 60_000),
        status: 'confirmed',
        zoneId: TEST_RESTAURANT_ZONE_ID,
        tableIds: [TEST_RESTAURANT_TABLE_ID],
      })
      try {
        await signInAs(page, 'service')

        // — allowed: nav + acting on a booking —
        await page.goto('/dashboard')
        const sidebar = page.locator('aside')
        for (const href of ['/dashboard', '/dashboard/bookings', '/dashboard/orders', '/dashboard/tabs', '/dashboard/guests']) {
          await expect(sidebar.locator(`a[href="${href}"]`)).toBeVisible()
        }
        await page.screenshot({ path: `${SHOTS}/service-today.png` })

        const attend = await page.request.post(`/api/dashboard/bookings/${seeded.bookingId}/attend`)
        expect(attend.status()).toBe(200)
        expect((await page.request.get('/api/dashboard/bookings')).status()).toBe(200)

        // — hidden nav: no Menu / Settings anywhere on the page —
        for (const href of ['/dashboard/menu', '/dashboard/settings', '/dashboard/analytics', '/dashboard/share']) {
          await expect(page.locator(`a[href="${href}"]`)).toHaveCount(0)
        }

        // — direct URL: redirect to Today —
        for (const path of ['/dashboard/menu', '/dashboard/settings', '/dashboard/settings/hours', '/dashboard/analytics', '/dashboard/settings/billing']) {
          await expectRedirect(page, path, '/dashboard')
        }
        // own account stays reachable
        await page.goto('/dashboard/settings/account')
        await expect(page).toHaveURL(/\/dashboard\/settings\/account$/)

        // — direct API: 403 —
        expect((await page.request.post(`/api/dashboard/menu/items/${ANY_UUID}/update`, { data: {} })).status()).toBe(403)
        expect((await page.request.post(`/api/dashboard/menu/items/${ANY_UUID}/toggle-86`, { data: {} })).status()).toBe(403)
        expect((await page.request.post('/api/dashboard/settings/hours', { data: {} })).status()).toBe(403)
        expect((await page.request.post('/api/dashboard/billing/cancel', { data: { reason: 'too_expensive' } })).status()).toBe(403)
        expect((await page.request.post('/api/dashboard/staff/invite', { data: { email: 'x@e2e.thetafel.invalid', role: 'kitchen' } })).status()).toBe(403)
        expect((await page.request.post('/api/dashboard/restaurant/pause')).status()).toBe(403)
      } finally {
        await wipeTestRestaurant()
        await cleanupSeededBookingDetail(seeded.guestId)
      }
    })

    test('lands in their own language (once per session)', async ({ page }) => {
      await signInAs(page, 'service') // staff language = nl
      await page.goto('/en/dashboard')
      await expect(page).toHaveURL(/localhost:\d+\/dashboard$/, { timeout: 15_000 })
      // a manual toggle afterwards is NOT fought
      await page.getByRole('button', { name: 'Switch to English' }).click()
      await expect(page).toHaveURL(/\/en\/dashboard$/)
      await page.waitForTimeout(1000)
      await expect(page).toHaveURL(/\/en\/dashboard$/)
    })
  })

  test.describe('kitchen', () => {
    test('order queue only', async ({ page }) => {
      test.setTimeout(90_000)
      await wipeTestRestaurant()
      const seeded = await seedOrders({
        restaurantId: TEST_RESTAURANT_ID,
        orders: [{ orderType: 'qr', status: 'confirmed', totalCents: 1500 }],
      })
      const orderId = seeded.orderIds[0]
      try {
        await signInAs(page, 'kitchen')

        // — lands on the orders queue, single-purpose shell, no navigation —
        await page.goto('/dashboard')
        await expect(page).toHaveURL(/\/dashboard\/orders$/)
        await expect(page.getByTestId('kitchen-shell')).toBeVisible()
        await expect(page.getByRole('navigation', { name: 'Hoofdnavigatie' })).toHaveCount(0)
        await expect(page.locator('aside')).toHaveCount(0)
        await expect(page.getByTestId('header-account')).toBeVisible()
        await expect(page.getByTestId('header-logout')).toBeVisible()
        await page.screenshot({ path: `${SHOTS}/kitchen-orders.png`, fullPage: true })

        // — allowed: advance an order (confirmed → preparing) —
        const advance = await page.request.post(`/api/dashboard/orders/${orderId}/advance`, { data: { to: 'preparing' } })
        expect(advance.status()).toBe(200)
        expect((await page.request.get('/api/dashboard/orders')).status()).toBe(200)

        // — direct URL: redirect to the queue —
        for (const path of ['/dashboard/bookings', '/dashboard/tabs', '/dashboard/guests', '/dashboard/menu', '/dashboard/settings']) {
          await expectRedirect(page, path, '/dashboard/orders')
        }
        await page.goto('/dashboard/settings/account')
        await expect(page).toHaveURL(/\/dashboard\/settings\/account$/)

        // — direct API: 403 —
        expect((await page.request.get('/api/dashboard/bookings')).status()).toBe(403)
        expect((await page.request.get('/api/dashboard/tabs')).status()).toBe(403)
        expect((await page.request.get('/api/dashboard/today')).status()).toBe(403)
        expect((await page.request.post(`/api/dashboard/bookings/${ANY_UUID}/attend`)).status()).toBe(403)
        expect((await page.request.post(`/api/dashboard/orders/${ANY_UUID}/cancel`, { data: {} })).status()).toBe(403)
        expect((await page.request.post(`/api/dashboard/orders/${ANY_UUID}/refund`, { data: {} })).status()).toBe(403)
        expect((await page.request.post(`/api/dashboard/tabs/${ANY_UUID}/close`, { data: { settlement: 'paid_at_table' } })).status()).toBe(403)

        // — log out works and protected pages then bounce to login —
        await page.goto('/dashboard/orders')
        await page.getByTestId('header-logout').click()
        await expect(page).toHaveURL(/\/login$/)
      } finally {
        await wipeTestRestaurant()
        await cleanupSeededOrderGuests(seeded.guestIds)
      }
    })
  })

  test.describe('deactivated staff', () => {
    test('a deactivated service user is logged out with a message', async ({ page }) => {
      test.setTimeout(90_000)
      try {
        await signInAs(page, 'service')
        await page.goto('/dashboard')
        await expect(page).toHaveURL(/\/dashboard$/)

        await setRoleActive('service', false)

        // API: no longer staff (no restaurant resolves for them any more)
        const res = await page.request.post(`/api/dashboard/bookings/${ANY_UUID}/attend`)
        expect([403, 404]).toContain(res.status())
        // Page: forced sign-out → /login with the deactivated notice
        await page.goto('/dashboard')
        await expect(page).toHaveURL(/\/login\?deactivated=1$/)
        await expect(page.getByTestId('login-deactivated')).toBeVisible()
        await page.screenshot({ path: `${SHOTS}/deactivated-login.png` })

        // Logging in again (auth user still exists) also ends on /login with the message.
        await signInAs(page, 'service')
        await page.goto('/dashboard')
        await expect(page).toHaveURL(/\/login\?deactivated=1$/)
      } finally {
        await setRoleActive('service', true)
      }
    })
  })
})
