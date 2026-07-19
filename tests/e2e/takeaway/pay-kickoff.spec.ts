import { test, expect } from '../fixtures/base'
import {
  adminClient,
  wipeTestRestaurant,
  TEST_RESTAURANT_ID,
  TEST_RESTAURANT_SLUG,
} from '../fixtures/test-restaurant'

// Original brief expected this test to reach a Mollie checkout redirect.
// That's not reachable: createConnectedPayment (lib/mollie/createConnectedPayment.ts)
// requires the restaurant to have a real Mollie OAuth connection
// (mollie_access_token + mollie_organization_id), and there is no dev-bypass
// for it anywhere in the code (unlike Turnstile). The _e2e_test_restaurant
// fixture has mollie_status='not_started' — connecting a real Mollie account
// is out of scope for e2e per C9.3c's own scope note ("Mollie sandbox
// interaction... out of scope").
//
// So this test verifies the actual, reproducible behavior instead: the order
// and payment_intent get created, then the Mollie call fails with
// 'not_connected' and the route marks both dead (order status='cancelled',
// payment_intent status='failed') and surfaces a generic error to the guest.
// Decided with the user (see conversation) rather than silently skipping or
// asserting a happy path that can't occur today.

test.describe('takeaway payment kickoff — Mollie not connected', () => {
  test.afterEach(async () => {
    await wipeTestRestaurant()
  })

  test('order + payment_intent are created then marked dead when Mollie is not connected', async ({
    page,
    testRunId,
  }) => {
    const email = `e2e-takeaway-${testRunId}@e2e.thetafel.invalid`

    await page.goto(`/r/${TEST_RESTAURANT_SLUG}/order`)

    // See tests/e2e/qr/pay-at-table.spec.ts for why this is scoped to the
    // first direct-child div rather than a plain section-text filter.
    const tomatensoepCard = page.locator('section').filter({ hasText: 'Voorgerechten' }).locator(':scope > div').first()
    await tomatensoepCard.getByRole('button', { name: 'Toevoegen' }).click()

    await page.getByRole('button', { name: /Bekijk bestelling/ }).click()
    await page.getByRole('button', { name: 'Doorgaan naar afrekenen' }).click()

    await expect(page).toHaveURL(/\/order\/pickup$/)
    // takeaway_scheduled_orders_allowed is false on the fixture restaurant,
    // so pickup is ASAP mode — a single confirm button, no slot grid.
    await page.getByRole('button', { name: 'Doorgaan' }).click()

    await expect(page).toHaveURL(/\/order\/details\?pickup=/)
    await page.getByRole('textbox', { name: 'Naam' }).fill('Piet Jansen')
    await page.getByRole('textbox', { name: 'Telefoonnummer' }).fill('+31 6 87654321')
    await page.getByRole('textbox', { name: 'E-mailadres' }).fill(email)
    await page.getByRole('button', { name: 'Naar betalen' }).click()

    // Next.js's own route-announcer also has role="alert" (empty text) —
    // match on the message text directly rather than the bare role. The
    // route does several sequential DB round trips (menu re-fetch, guest
    // upsert, order + payment_intent inserts) before even reaching the
    // Mollie call, so this can take longer than the default 5s.
    await expect(page.getByText('Betalen lukt nu even niet. Probeer opnieuw.')).toBeVisible({
      timeout: 15_000,
    })
    // No redirect — still on the details page, order failed before any
    // Mollie hop happened.
    await expect(page).toHaveURL(/\/order\/details\?pickup=/)

    const supabase = adminClient()
    const { data: orders } = await supabase
      .from('orders')
      .select('id, order_type, status, payment_status, guest_id, tab_id, total_cents, payment_intent_id')
      .eq('restaurant_id', TEST_RESTAURANT_ID)
    expect(orders).toHaveLength(1)
    const order = orders![0]

    expect(order.order_type).toBe('takeaway')
    // Not 'pending' as the original brief expected — the route marks the
    // order 'cancelled' once the Mollie call fails (transactionalInsert.ts /
    // the takeaway route's failure branch), even though payment_status
    // itself stays 'pending' (orders_payment_status_check has no 'failed'
    // value — a known latent gap noted in the route's own comments).
    expect(order.status).toBe('cancelled')
    expect(order.payment_status).toBe('pending')
    expect(order.tab_id).toBeNull() // takeaway never opens a tab
    expect(order.total_cents).toBe(750)
    expect(order.guest_id).not.toBeNull()

    const { data: guest } = await supabase
      .from('guests')
      .select('full_name, email_lower, phone')
      .eq('id', order.guest_id)
      .single()
    expect(guest?.email_lower).toBe(email.toLowerCase())
    expect(guest?.full_name).toBe('Piet Jansen')
    expect(guest?.phone).toBe('+31687654321')

    const { data: intents } = await supabase
      .from('payment_intents')
      .select('purpose, status, provider_payment_id, amount_cents')
      .eq('id', order.payment_intent_id!)
    expect(intents).toHaveLength(1)
    expect(intents![0].purpose).toBe('takeaway_order')
    expect(intents![0].status).toBe('failed')
    expect(intents![0].provider_payment_id).toBeNull() // never reached Mollie
    expect(intents![0].amount_cents).toBe(750)

    const { data: auditRows } = await supabase
      .from('consumer_audit_logs')
      .select('event_type')
      .eq('order_id', order.id)
    const eventTypes = (auditRows ?? []).map((r) => r.event_type)
    expect(eventTypes).toContain('takeaway.order_submitted')
    expect(eventTypes).toContain('takeaway.order_payment_failed')
  })
})
