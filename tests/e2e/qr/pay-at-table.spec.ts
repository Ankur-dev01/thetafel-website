import { test, expect } from '../fixtures/base'
import {
  adminClient,
  wipeTestRestaurant,
  TEST_RESTAURANT_ID,
  TEST_RESTAURANT_SLUG,
  TEST_RESTAURANT_TABLE_QR_TOKEN,
} from '../fixtures/test-restaurant'

// QR ordering is fully anonymous — no guest name/email/phone form exists in
// this flow (OrderSubmit.tsx has no fields, just cart + Turnstile + submit).
// orders.guest_id stays NULL for QR orders; there's nothing to collect here,
// contrary to what the original brief assumed.
//
// Pay-at-table needs qr_pay_at_table_enabled=true, which the restaurant
// seeded in C9.3a.1 did NOT have (schema default is false) — flipped on
// directly via Supabase MCP before writing this spec.

test.describe('QR pay-at-table happy path', () => {
  test.afterEach(async () => {
    await wipeTestRestaurant()
  })

  test('orders 2x Biefstuk + 1x Tomatensoep and pays at table', async ({ page }) => {
    await page.goto(`/r/${TEST_RESTAURANT_SLUG}/qr/${TEST_RESTAURANT_TABLE_QR_TOKEN}/menu`)

    await expect(page.getByRole('heading', { name: 'Voorgerechten' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Hoofdgerechten' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Desserts' })).toBeVisible()

    // Each menu category renders as a <section> (MenuBrowser.tsx), and each
    // item is one direct-child <div> of that section (MenuItemCard's root
    // element) in seed order — Biefstuk is the first item under
    // Hoofdgerechten, Tomatensoep the first under Voorgerechten. Scoping to
    // the first direct-child div avoids the strict-mode collision a plain
    // section-text filter has with the category's second item (Zalm also
    // has a "Toevoegen" button until it's added).
    const biefstukCard = page.locator('section').filter({ hasText: 'Hoofdgerechten' }).locator(':scope > div').first()
    const tomatensoepCard = page.locator('section').filter({ hasText: 'Voorgerechten' }).locator(':scope > div').first()

    await biefstukCard.getByRole('button', { name: 'Toevoegen' }).click()
    await biefstukCard.getByLabel('+').click() // Biefstuk qty 1 -> 2
    await tomatensoepCard.getByRole('button', { name: 'Toevoegen' }).click() // Tomatensoep qty 1

    // 2 x Biefstuk (1850) + 1 x Tomatensoep (750) = 4450 cents = €44,50
    await expect(page.getByRole('button', { name: /€ 44,50/ })).toBeVisible()

    await page.getByRole('button', { name: /Bekijk bestelling/ }).click()
    await expect(page.getByText('Totaal € 44,50')).toBeVisible()
    await page.getByRole('button', { name: 'Doorgaan naar afrekenen' }).click()

    await expect(page).toHaveURL(/\/checkout$/)
    await page.getByRole('button', { name: /^Betalen aan tafel/ }).click()
    await page.getByRole('button', { name: 'Doorgaan' }).click()

    await expect(page).toHaveURL(/\/pay\?mode=pay_at_table$/)
    await page.getByRole('button', { name: 'Bestelling plaatsen' }).click()

    await page.waitForURL(/\/qr\/order\//)
    await expect(page.getByRole('heading', { name: 'Doorgezet naar de keuken' })).toBeVisible()
    await expect(page.getByText('2× Biefstuk')).toBeVisible()
    await expect(page.getByText('1× Tomatensoep')).toBeVisible()
    await expect(page.getByText('€ 44,50').last()).toBeVisible()

    const orderRefText = await page.getByText(/^QR-/).textContent()
    const orderRef = orderRefText?.trim()
    expect(orderRef).toMatch(/^QR-/)

    const supabase = adminClient()
    const { data: orders } = await supabase
      .from('orders')
      .select('id, order_type, status, payment_status, guest_id, tab_id, subtotal_cents, total_cents')
      .eq('restaurant_id', TEST_RESTAURANT_ID)
      .eq('order_ref', orderRef!)
    expect(orders).toHaveLength(1)
    const order = orders![0]

    expect(order.order_type).toBe('qr')
    expect(order.status).toBe('confirmed')
    expect(order.payment_status).toBe('open_tab')
    // No guest form in the QR flow at all — guest_id is never set.
    expect(order.guest_id).toBeNull()
    expect(order.total_cents).toBe(4450)

    const { data: tabs } = await supabase
      .from('tabs')
      .select('id, status, total_cents')
      .eq('restaurant_id', TEST_RESTAURANT_ID)
    expect(tabs).toHaveLength(1)
    expect(tabs![0].status).toBe('open')
    expect(tabs![0].total_cents).toBe(4450)

    // One order_items row per distinct menu item (quantity is a column, not
    // one row per unit) — 2 rows here, not 3 as the original brief assumed.
    const { data: items } = await supabase
      .from('order_items')
      .select('name_snapshot, quantity, unit_price_cents, line_total_cents')
      .eq('order_id', order.id)
      .order('unit_price_cents', { ascending: false })
    expect(items).toHaveLength(2)
    expect(items![0]).toMatchObject({ name_snapshot: 'Biefstuk', quantity: 2, unit_price_cents: 1850, line_total_cents: 3700 })
    expect(items![1]).toMatchObject({ name_snapshot: 'Tomatensoep', quantity: 1, unit_price_cents: 750, line_total_cents: 750 })

    const { data: auditRows } = await supabase
      .from('consumer_audit_logs')
      .select('event_type')
      .eq('order_id', order.id)
    const eventTypes = (auditRows ?? []).map((r) => r.event_type)
    expect(eventTypes).toContain('qr.order_submitted')
    expect(eventTypes).toContain('tab.joined')
  })
})
