import { test, expect } from './fixtures/base'
import { adminClient, TEST_RESTAURANT_ID } from './fixtures/test-restaurant'
import { signInAsTestOwner } from './fixtures/dashboard-auth'
import { getQrSettingsConfig, resetTestRestaurantQrSettings } from './fixtures/resetTestRestaurantQrSettings'

// A real restaurant id from the same table — used only to prove the route
// never touches anything but the caller's own restaurant. Never written to.
const OTHER_RESTAURANT_ID = '288b0437-81da-4089-98e4-d89227a98004'

const QR_COLUMNS =
  'qr_auto_accept, qr_item_notes_enabled, qr_menu_language, qr_widget_accent_color, qr_pay_now_enabled, qr_pay_at_table_enabled'

async function setServiceQrEnabled(value: boolean): Promise<void> {
  const { error } = await adminClient().from('restaurants').update({ service_qr_enabled: value }).eq('id', TEST_RESTAURANT_ID)
  if (error) throw new Error(`setServiceQrEnabled failed: ${error.message}`)
}

test.describe('Settings — QR ordering editor (D5.5)', () => {
  // Per the D5.3/D5.4 lesson: every test starts from the canonical seed so
  // state mutated by one test never leaks into the next.
  test.beforeEach(async () => {
    await resetTestRestaurantQrSettings()
  })

  test('T1: page load reflects current values', async ({ page }) => {
    await signInAsTestOwner(page)
    await page.goto('/dashboard/settings/qr')

    await expect(page.locator('[data-testid="qr-auto-accept"]')).toBeChecked()
    await expect(page.locator('[data-testid="qr-item-notes"]')).toBeChecked()
    await expect(page.locator('[data-testid="qr-menu-language"]')).toHaveValue('nl_en')
    await expect(page.locator('[data-testid="qr-accent-color-hex"]')).toHaveValue('#d4820a')
    await expect(page.locator('[data-testid="qr-pay-now"]')).toBeChecked()
    await expect(page.locator('[data-testid="qr-pay-at-table"]')).toBeChecked()
    await expect(page.locator('[data-testid="qr-codes-placeholder"]')).toBeVisible()
  })

  test('T2: change auto-accept off, item notes off, accent colour, save, reload, persists', async ({ page }) => {
    await signInAsTestOwner(page)
    await page.goto('/dashboard/settings/qr')

    await page.locator('[data-testid="qr-auto-accept"]').uncheck()
    await page.locator('[data-testid="qr-item-notes"]').uncheck()
    await page.locator('[data-testid="qr-accent-color-hex"]').fill('#4a5568')

    await expect(page.locator('[data-testid="qr-save"]')).toBeEnabled()
    await page.locator('[data-testid="qr-save"]').click()
    await expect(page.locator('[data-testid="qr-saved-toast"]')).toBeVisible()

    await page.reload()
    await expect(page.locator('[data-testid="qr-auto-accept"]')).not.toBeChecked()
    await expect(page.locator('[data-testid="qr-item-notes"]')).not.toBeChecked()
    await expect(page.locator('[data-testid="qr-accent-color-hex"]')).toHaveValue('#4a5568')

    const row = await getQrSettingsConfig()
    expect(row.qr_auto_accept).toBe(false)
    expect(row.qr_item_notes_enabled).toBe(false)
    expect(row.qr_widget_accent_color).toBe('#4a5568')
  })

  // NOTE: D5.5's own preflight found `qr_menu_language` is currently
  // dormant on the consumer side — no QR page reads it yet (the guest-facing
  // menu language is driven by the URL locale segment, not this column).
  // This test verifies the setting persists correctly through save/reload;
  // it does NOT assert any guest-facing effect, because there isn't one to
  // assert yet. See the D9.4 note in the build report.
  test('T3: change menu language to en, save, reload, persists', async ({ page }) => {
    await signInAsTestOwner(page)
    await page.goto('/dashboard/settings/qr')

    await page.locator('[data-testid="qr-menu-language"]').selectOption('en')
    await page.locator('[data-testid="qr-save"]').click()
    await expect(page.locator('[data-testid="qr-saved-toast"]')).toBeVisible()

    await page.reload()
    await expect(page.locator('[data-testid="qr-menu-language"]')).toHaveValue('en')

    const row = await getQrSettingsConfig()
    expect(row.qr_menu_language).toBe('en')
  })

  test('T4: validation errors (direct route POST)', async ({ page }) => {
    await signInAsTestOwner(page)

    const base = {
      qr_auto_accept: true,
      qr_item_notes_enabled: true,
      qr_menu_language: 'nl_en',
      qr_widget_accent_color: '#d4820a',
      qr_pay_now_enabled: true,
      qr_pay_at_table_enabled: true,
    }

    for (const badColor of ['red', '#abc', '#GGGGGG']) {
      const res = await page.request.post('/api/dashboard/settings/qr', {
        data: { ...base, qr_widget_accent_color: badColor },
      })
      expect(res.status()).toBe(400)
      expect((await res.json()).code).toBe('accent_color_invalid')
    }

    const res = await page.request.post('/api/dashboard/settings/qr', {
      data: { ...base, qr_menu_language: 'fr' },
    })
    expect(res.status()).toBe(400)
    expect((await res.json()).code).toBe('menu_language_invalid')
  })

  test('T5: server rejects both payment modes off', async ({ page }) => {
    await signInAsTestOwner(page)

    const res = await page.request.post('/api/dashboard/settings/qr', {
      data: {
        qr_auto_accept: true,
        qr_item_notes_enabled: true,
        qr_menu_language: 'nl_en',
        qr_widget_accent_color: '#d4820a',
        qr_pay_now_enabled: false,
        qr_pay_at_table_enabled: false,
      },
    })
    expect(res.status()).toBe(400)
    expect((await res.json()).code).toBe('qr_needs_payment_method')
  })

  test('T6: service_qr_enabled=false renders the informational card, POST rejected', async ({ page }) => {
    await setServiceQrEnabled(false)
    try {
      await signInAsTestOwner(page)
      await page.goto('/dashboard/settings/qr')

      await expect(page.locator('[data-testid="qr-disabled-card"]')).toBeVisible()
      await expect(page.locator('[data-testid="qr-config-section"]')).toHaveCount(0)
      await expect(page.locator('[data-testid="qr-save"]')).toHaveCount(0)

      const res = await page.request.post('/api/dashboard/settings/qr', {
        data: {
          qr_auto_accept: true,
          qr_item_notes_enabled: true,
          qr_menu_language: 'nl_en',
          qr_widget_accent_color: '#d4820a',
          qr_pay_now_enabled: true,
          qr_pay_at_table_enabled: true,
        },
      })
      expect(res.status()).toBe(409)
      expect((await res.json()).code).toBe('qr_not_enabled')
    } finally {
      await setServiceQrEnabled(true)
    }
  })

  test.skip('T7: rate limit fires (unreachable in dev-mode e2e — see D5.1/D5.2/D5.3/D5.4 rationale)', async () => {})

  test('T8: cross-restaurant safety', async ({ page }) => {
    const { data: before } = await adminClient().from('restaurants').select(QR_COLUMNS).eq('id', OTHER_RESTAURANT_ID).single()

    await signInAsTestOwner(page)
    await page.goto('/dashboard/settings/qr')
    await page.locator('[data-testid="qr-auto-accept"]').uncheck()
    await page.locator('[data-testid="qr-save"]').click()
    await expect(page.locator('[data-testid="qr-saved-toast"]')).toBeVisible()

    const { data: after } = await adminClient().from('restaurants').select(QR_COLUMNS).eq('id', OTHER_RESTAURANT_ID).single()
    expect(after).toEqual(before)
  })

  test('T9: audit row carries fields_changed only', async ({ page }) => {
    await signInAsTestOwner(page)
    await page.goto('/dashboard/settings/qr')

    await page.locator('[data-testid="qr-auto-accept"]').uncheck()
    await page.locator('[data-testid="qr-menu-language"]').selectOption('nl')
    await page.locator('[data-testid="qr-save"]').click()
    await expect(page.locator('[data-testid="qr-saved-toast"]')).toBeVisible()

    const { data: rows } = await adminClient()
      .from('dashboard_audit_logs')
      .select('*')
      .eq('restaurant_id', TEST_RESTAURANT_ID)
      .eq('event_type', 'settings.qr.edit')
      .order('created_at', { ascending: false })
      .limit(1)

    const audit = rows?.[0]
    expect(audit).toBeTruthy()
    const fieldsChanged = audit.event_data.fields_changed as string[]
    expect(fieldsChanged).toContain('qr_auto_accept')
    expect(fieldsChanged).toContain('qr_menu_language')
  })
})
