import { test, expect } from '../fixtures/base'
import { TEST_RESTAURANT_ID, adminClient } from '../fixtures/test-restaurant'
import { signInAsTestOwner } from '../fixtures/dashboard-auth'
import { seedMenu, cleanupSeededMenu, cleanupD43TestItems } from '../fixtures/seed-menu'

const PREFIX = '_D43_test_'

async function variantsFor(itemId: string) {
  const { data } = await adminClient()
    .from('menu_item_variants')
    .select('id, name_nl, price_delta_cents')
    .eq('item_id', itemId)
    .order('created_at', { ascending: true })
  return data ?? []
}

async function seedItemWithVariants(variants: { name_nl: string; price_delta_cents: number }[]) {
  const seeded = await seedMenu({
    restaurantId: TEST_RESTAURANT_ID,
    categories: [
      { name: `${PREFIX}var_cat`, displayOrder: 360, items: [{ name: `${PREFIX}var_item`, priceCents: 1200 }] },
    ],
  })
  const itemId = seeded.itemIds[0]
  if (variants.length > 0) {
    await adminClient()
      .from('menu_item_variants')
      .insert(variants.map((v) => ({ item_id: itemId, ...v })))
  }
  return { seeded, itemId }
}

/** Opens the item edit dialog with the variants section expanded. */
async function openVariants(page: import('@playwright/test').Page, itemId: string) {
  await page.goto(`/dashboard/menu?item=${itemId}&edit=1`)
  await expect(page.locator('[data-testid="item-edit-dialog"]')).toBeVisible()
  await page.locator('[data-testid="item-variants-toggle"]').click()
  await expect(page.locator('[data-testid="variant-editor"]')).toBeVisible()
}

test.describe('Menu item variants (D4.3)', () => {
  test.afterAll(async () => {
    await cleanupD43TestItems(TEST_RESTAURANT_ID)
  })

  test('add a variant with a positive delta', async ({ page }) => {
    test.setTimeout(60_000)
    const { seeded, itemId } = await seedItemWithVariants([])

    try {
      await signInAsTestOwner(page)
      await openVariants(page, itemId)

      await page.locator('[data-testid="variant-new-name"]').fill('Extra kaas')
      await page.locator('[data-testid="variant-new-delta"]').fill('+1,50')
      await page.locator('[data-testid="variant-add"]').click()

      await expect(async () => {
        const rows = await variantsFor(itemId)
        expect(rows).toHaveLength(1)
        expect(rows[0].name_nl).toBe('Extra kaas')
        expect(rows[0].price_delta_cents).toBe(150)
      }).toPass({ timeout: 10_000 })
    } finally {
      await cleanupSeededMenu(seeded)
      await cleanupD43TestItems(TEST_RESTAURANT_ID)
    }
  })

  test('edit a variant to a negative delta', async ({ page }) => {
    test.setTimeout(60_000)
    const { seeded, itemId } = await seedItemWithVariants([{ name_nl: 'Normale portie', price_delta_cents: 0 }])
    const [variant] = await variantsFor(itemId)

    try {
      await signInAsTestOwner(page)
      await openVariants(page, itemId)

      await page.locator(`[data-testid="variant-edit-${variant.id}"]`).click()
      const nameInput = page.getByLabel('Naam van variant')
      await nameInput.fill('Kleine portie')
      await page.getByLabel('+1,50 of -3,00').fill('-3,00')
      await page.locator(`[data-testid="variant-save-${variant.id}"]`).click()

      await expect(async () => {
        const rows = await variantsFor(itemId)
        expect(rows).toHaveLength(1)
        expect(rows[0].name_nl).toBe('Kleine portie')
        expect(rows[0].price_delta_cents).toBe(-300)
      }).toPass({ timeout: 10_000 })
    } finally {
      await cleanupSeededMenu(seeded)
      await cleanupD43TestItems(TEST_RESTAURANT_ID)
    }
  })

  test('delete one variant, leaving the other', async ({ page }) => {
    test.setTimeout(60_000)
    const { seeded, itemId } = await seedItemWithVariants([
      { name_nl: 'Variant een', price_delta_cents: 100 },
      { name_nl: 'Variant twee', price_delta_cents: 200 },
    ])
    const before = await variantsFor(itemId)
    const doomed = before[0]

    try {
      await signInAsTestOwner(page)
      await openVariants(page, itemId)

      await page.locator(`[data-testid="variant-delete-${doomed.id}"]`).click()
      await page.locator(`[data-testid="variant-delete-confirm-${doomed.id}"]`).click()

      await expect(async () => {
        const rows = await variantsFor(itemId)
        expect(rows).toHaveLength(1)
        expect(rows[0].name_nl).toBe('Variant twee')
      }).toPass({ timeout: 10_000 })
    } finally {
      await cleanupSeededMenu(seeded)
      await cleanupD43TestItems(TEST_RESTAURANT_ID)
    }
  })

  test('variant validation and cascade on item delete', async ({ page }) => {
    test.setTimeout(60_000)
    const { seeded, itemId } = await seedItemWithVariants([{ name_nl: 'Blijft even', price_delta_cents: 50 }])

    try {
      await signInAsTestOwner(page)

      const emptyName = await page.request.post(`/api/dashboard/menu/items/${itemId}/variants/create`, {
        data: { name_nl: '', price_delta_cents: 100 },
      })
      expect(emptyName.status()).toBe(400)
      expect((await emptyName.json()).errors).toContainEqual({ field: 'name_nl', code: 'variant_name_required' })

      const extreme = await page.request.post(`/api/dashboard/menu/items/${itemId}/variants/create`, {
        data: { name_nl: 'Veel te duur', price_delta_cents: 100000 },
      })
      expect(extreme.status()).toBe(400)
      expect((await extreme.json()).errors).toContainEqual({
        field: 'price_delta_cents',
        code: 'price_delta_too_extreme',
      })

      // A variant on another restaurant's item must not be reachable.
      const foreign = await page.request.post(
        '/api/dashboard/menu/items/11111111-1111-4111-8111-111111111111/variants/create',
        { data: { name_nl: 'Nope', price_delta_cents: 100 } },
      )
      expect(foreign.status()).toBe(404)

      expect(await variantsFor(itemId)).toHaveLength(1)

      // Deleting the parent item cascades its variants away (FK ON DELETE CASCADE).
      const del = await page.request.post(`/api/dashboard/menu/items/${itemId}/delete`, { data: {} })
      expect(del.status()).toBe(200)
      expect(await variantsFor(itemId)).toHaveLength(0)
    } finally {
      await cleanupSeededMenu(seeded)
      await cleanupD43TestItems(TEST_RESTAURANT_ID)
    }
  })
})
