import { test, expect } from '../fixtures/base'
import { TEST_RESTAURANT_ID, TEST_RESTAURANT_SLUG, TEST_RESTAURANT_TABLE_QR_TOKEN, adminClient } from '../fixtures/test-restaurant'
import { signInAsTestOwner } from '../fixtures/dashboard-auth'
import {
  seedMenu,
  cleanupSeededMenu,
  cleanupD42TestCategories,
  snapshotCategoryOrder,
  restoreCategoryOrder,
} from '../fixtures/seed-menu'

// Everything here is scoped to throwaway categories named `_D42_test_*`. The
// test restaurant's permanent 3 categories (Voorgerechten / Hoofdgerechten /
// Desserts) are never renamed or deleted — tests/e2e/qr/pay-at-table.spec.ts
// reads them by name and by position. The one test that reorders (Test 7)
// snapshots every category's display_order first and restores it in `finally`,
// because the reorder route rewrites the whole restaurant's ordering.

const PREFIX = '_D42_test_'

async function getCategoryByName(nameNl: string) {
  const supabase = adminClient()
  const { data } = await supabase
    .from('menu_categories')
    .select('*')
    .eq('restaurant_id', TEST_RESTAURANT_ID)
    .eq('name_nl', nameNl)
    .maybeSingle()
  return data
}

async function getCategoryById(id: string) {
  const supabase = adminClient()
  const { data } = await supabase.from('menu_categories').select('*').eq('id', id).maybeSingle()
  return data
}

async function getAuditRows(eventType: string) {
  const supabase = adminClient()
  const { data } = await supabase
    .from('dashboard_audit_logs')
    .select('*')
    .eq('restaurant_id', TEST_RESTAURANT_ID)
    .eq('event_type', eventType)
    .order('created_at', { ascending: false })
  return data ?? []
}

async function allCategoriesOrdered() {
  const supabase = adminClient()
  const { data } = await supabase
    .from('menu_categories')
    .select('id, name_nl, display_order')
    .eq('restaurant_id', TEST_RESTAURANT_ID)
    .order('display_order', { ascending: true })
  return data ?? []
}

test.describe('Menu category CRUD + reorder (D4.2)', () => {
  test.afterAll(async () => {
    await cleanupD42TestCategories(TEST_RESTAURANT_ID)
  })

  test('create category with only a Dutch name', async ({ page }) => {
    test.setTimeout(60_000)
    const name = `${PREFIX}alpha`
    const before = await allCategoriesOrdered()
    const maxBefore = Math.max(...before.map((c) => c.display_order as number), -1)

    try {
      await signInAsTestOwner(page)
      await page.goto('/dashboard/menu')

      await page.locator('[data-testid="menu-category-add"]:visible').first().click()
      await expect(page.locator('[data-testid="category-edit-dialog"]')).toBeVisible()

      await page.locator('#category-name-nl').fill(name)
      await page.locator('[data-testid="category-submit"]').click()
      await expect(page.locator('[data-testid="category-edit-dialog"]')).toHaveCount(0, { timeout: 10_000 })

      const row = await getCategoryByName(name)
      expect(row).toBeTruthy()
      expect(row!.name_en).toBeNull()
      expect(row!.window_start).toBeNull()
      expect(row!.window_end).toBeNull()
      expect(row!.visible_takeaway).toBe(true)
      expect(row!.visible_qr).toBe(true)
      expect(row!.display_order).toBe(maxBefore + 1)

      const audits = await getAuditRows('menu.category.created')
      expect(audits.some((a) => a.event_data.category_id === row!.id)).toBe(true)
    } finally {
      await cleanupD42TestCategories(TEST_RESTAURANT_ID)
    }
  })

  test('create category with every field set', async ({ page }) => {
    test.setTimeout(60_000)
    const name = `${PREFIX}lunch`

    try {
      await signInAsTestOwner(page)
      await page.goto('/dashboard/menu')

      await page.locator('[data-testid="menu-category-add"]:visible').first().click()
      await page.locator('#category-name-nl').fill(name)
      await page.locator('#category-name-en').fill('Lunch')
      await page.locator('[data-testid="category-window-toggle"]').check()
      await page.locator('#category-window-start').fill('12:00')
      await page.locator('#category-window-end').fill('15:00')
      await page.locator('[data-testid="category-visible-takeaway"]').uncheck()
      await page.locator('[data-testid="category-submit"]').click()
      await expect(page.locator('[data-testid="category-edit-dialog"]')).toHaveCount(0, { timeout: 10_000 })

      const row = await getCategoryByName(name)
      expect(row).toBeTruthy()
      expect(row!.name_en).toBe('Lunch')
      expect(String(row!.window_start).slice(0, 5)).toBe('12:00')
      expect(String(row!.window_end).slice(0, 5)).toBe('15:00')
      expect(row!.visible_takeaway).toBe(false)
      expect(row!.visible_qr).toBe(true)

      await page.goto(`/dashboard/menu?category=${row!.id}`)
      await expect(page.locator(`[data-testid="menu-category-row-${row!.id}"]:visible`)).toContainText('12:00 – 15:00')
    } finally {
      await cleanupD42TestCategories(TEST_RESTAURANT_ID)
    }
  })

  test('validation errors, client and server', async ({ page }) => {
    test.setTimeout(60_000)

    try {
      await signInAsTestOwner(page)
      await page.goto('/dashboard/menu')

      await page.locator('[data-testid="menu-category-add"]:visible').first().click()
      const dialog = page.locator('[data-testid="category-edit-dialog"]')

      // Empty Dutch name.
      await page.locator('[data-testid="category-submit"]').click()
      await expect(dialog.getByText('Nederlandse naam is verplicht.')).toBeVisible()

      // Only one window bound filled.
      await page.locator('#category-name-nl').fill(`${PREFIX}validation`)
      await page.locator('[data-testid="category-window-toggle"]').check()
      await page.locator('#category-window-start').fill('12:00')
      await page.locator('[data-testid="category-submit"]').click()
      await expect(dialog.getByText('Vul beide tijden in, of laat beide leeg.')).toBeVisible()

      // Start after end.
      await page.locator('#category-window-end').fill('11:00')
      await page.locator('[data-testid="category-submit"]').click()
      await expect(dialog.getByText('Starttijd moet voor eindtijd zijn.')).toBeVisible()

      // Over-long name.
      await page.locator('[data-testid="category-window-toggle"]').uncheck()
      await page.locator('#category-name-nl').fill('x'.repeat(61))
      await page.locator('[data-testid="category-submit"]').click()
      await expect(dialog.getByText('Naam is te lang (max 60 tekens).')).toBeVisible()

      // Server rejects independently of the client.
      const res = await page.request.post('/api/dashboard/menu/categories/create', {
        data: { name_nl: '', name_en: null, window_start: null, window_end: null, visible_takeaway: true, visible_qr: true },
      })
      expect(res.status()).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('invalid_body')
      expect(body.errors).toContainEqual({ field: 'name_nl', code: 'name_nl_required' })
    } finally {
      await cleanupD42TestCategories(TEST_RESTAURANT_ID)
    }
  })

  test('edit category clears English name and window', async ({ page }) => {
    test.setTimeout(60_000)
    const seeded = await seedMenu({
      restaurantId: TEST_RESTAURANT_ID,
      categories: [
        { name: `${PREFIX}edit_source`, displayOrder: 200, windowStart: '10:00:00', windowEnd: '14:00:00', items: [] },
      ],
    })
    const categoryId = seeded.categoryIds[0]
    await adminClient().from('menu_categories').update({ name_en: 'Edit Source' }).eq('id', categoryId)

    try {
      await signInAsTestOwner(page)
      await page.goto('/dashboard/menu')

      await page.locator(`[data-testid="menu-category-edit-${categoryId}"]:visible`).click()
      await expect(page.locator('[data-testid="category-edit-dialog"]')).toBeVisible()

      await page.locator('#category-name-nl').fill(`${PREFIX}edit_target`)
      await page.locator('#category-name-en').fill('')
      await page.locator('[data-testid="category-window-toggle"]').uncheck()
      await page.locator('[data-testid="category-submit"]').click()
      await expect(page.locator('[data-testid="category-edit-dialog"]')).toHaveCount(0, { timeout: 10_000 })

      const row = await getCategoryById(categoryId)
      expect(row!.name_nl).toBe(`${PREFIX}edit_target`)
      expect(row!.name_en).toBeNull()
      expect(row!.window_start).toBeNull()
      expect(row!.window_end).toBeNull()

      const audit = (await getAuditRows('menu.category.updated')).find((a) => a.event_data.category_id === categoryId)
      expect(audit).toBeTruthy()
      expect(Object.keys(audit!.event_data.changes).sort()).toEqual(
        ['name_en', 'name_nl', 'window_end', 'window_start'].sort(),
      )
    } finally {
      await cleanupSeededMenu(seeded)
      await cleanupD42TestCategories(TEST_RESTAURANT_ID)
    }
  })

  test('delete an empty category', async ({ page }) => {
    test.setTimeout(60_000)
    const seeded = await seedMenu({
      restaurantId: TEST_RESTAURANT_ID,
      categories: [{ name: `${PREFIX}delete_me`, displayOrder: 201, items: [] }],
    })
    const categoryId = seeded.categoryIds[0]

    try {
      await signInAsTestOwner(page)
      await page.goto('/dashboard/menu')

      await page.locator(`[data-testid="menu-category-edit-${categoryId}"]:visible`).click()
      await page.locator('[data-testid="category-delete-open"]').click()
      await expect(page.locator('[data-testid="category-delete-confirm"]')).toBeVisible()
      await page.getByRole('button', { name: 'Ja, verwijder' }).click()

      await expect(async () => {
        expect(await getCategoryById(categoryId)).toBeNull()
      }).toPass({ timeout: 10_000 })

      // Everything that survived is dense and 0-based.
      const remaining = await allCategoriesOrdered()
      expect(remaining.map((c) => c.display_order)).toEqual(remaining.map((_, i) => i))

      const audit = (await getAuditRows('menu.category.deleted')).find((a) => a.event_data.category_id === categoryId)
      expect(audit).toBeTruthy()
    } finally {
      await cleanupD42TestCategories(TEST_RESTAURANT_ID)
    }
  })

  test('delete is blocked while the category still has items', async ({ page }) => {
    test.setTimeout(60_000)
    const seeded = await seedMenu({
      restaurantId: TEST_RESTAURANT_ID,
      categories: [
        {
          name: `${PREFIX}has_items`,
          displayOrder: 202,
          items: [
            { name: `${PREFIX}item_1`, priceCents: 500 },
            { name: `${PREFIX}item_2`, priceCents: 600 },
          ],
        },
      ],
    })
    const categoryId = seeded.categoryIds[0]

    try {
      await signInAsTestOwner(page)
      await page.goto('/dashboard/menu')

      await page.locator(`[data-testid="menu-category-edit-${categoryId}"]:visible`).click()
      await page.locator('[data-testid="category-delete-open"]').click()

      const blocked = page.locator('[data-testid="category-delete-blocked"]')
      await expect(blocked).toBeVisible()
      await expect(blocked).toContainText('2 items')
      await expect(page.getByRole('button', { name: 'Ja, verwijder' })).toHaveCount(0)
      await page.getByRole('button', { name: 'Sluiten' }).click()

      expect(await getCategoryById(categoryId)).toBeTruthy()

      // Server blocks independently of what the UI offered.
      const res = await page.request.post(`/api/dashboard/menu/categories/${categoryId}/delete`, { data: {} })
      expect(res.status()).toBe(409)
      const body = await res.json()
      expect(body.error).toBe('has_items')
      expect(body.item_count).toBe(2)
      expect(await getCategoryById(categoryId)).toBeTruthy()
    } finally {
      await cleanupSeededMenu(seeded)
      await cleanupD42TestCategories(TEST_RESTAURANT_ID)
    }
  })

  test('reorder renumbers every category densely from zero', async ({ page }) => {
    test.setTimeout(60_000)
    const snapshot = await snapshotCategoryOrder(TEST_RESTAURANT_ID)
    const seeded = await seedMenu({
      restaurantId: TEST_RESTAURANT_ID,
      categories: [
        { name: `${PREFIX}reorder_A`, displayOrder: 210, items: [] },
        { name: `${PREFIX}reorder_B`, displayOrder: 211, items: [] },
        { name: `${PREFIX}reorder_C`, displayOrder: 212, items: [] },
      ],
    })
    const [aId, bId, cId] = seeded.categoryIds

    try {
      await signInAsTestOwner(page)

      // Drive the route directly: HTML5 drag-and-drop is not reliably
      // simulatable in Playwright, and the route is where the renumber logic
      // that matters actually lives. The optimistic UI path is exercised
      // manually (see the D4.2 verification notes).
      const before = await allCategoriesOrdered()
      const permanentIds = before.filter((c) => !String(c.name_nl).startsWith(PREFIX)).map((c) => c.id as string)
      const newOrder = [...permanentIds, cId, aId, bId]

      const res = await page.request.post('/api/dashboard/menu/categories/reorder', {
        data: { ordered_ids: newOrder },
      })
      expect(res.status()).toBe(200)

      const after = await allCategoriesOrdered()
      expect(after.map((c) => c.display_order)).toEqual(after.map((_, i) => i))
      expect(after.map((c) => c.id)).toEqual(newOrder)

      const audit = (await getAuditRows('menu.category.reordered'))[0]
      expect(audit.event_data.new_order).toHaveLength(newOrder.length)
      expect(audit.event_data.new_order[0]).toEqual({ id: newOrder[0], display_order: 0 })
    } finally {
      await cleanupSeededMenu(seeded)
      await cleanupD42TestCategories(TEST_RESTAURANT_ID)
      await restoreCategoryOrder(snapshot)
    }
  })

  test('reorder via the drag-and-drop UI persists', async ({ page }) => {
    test.setTimeout(90_000)
    const snapshot = await snapshotCategoryOrder(TEST_RESTAURANT_ID)
    const seeded = await seedMenu({
      restaurantId: TEST_RESTAURANT_ID,
      categories: [
        { name: `${PREFIX}dragA`, displayOrder: 230, items: [] },
        { name: `${PREFIX}dragB`, displayOrder: 231, items: [] },
      ],
    })
    const [aId, bId] = seeded.categoryIds

    try {
      await signInAsTestOwner(page)
      await page.goto('/dashboard/menu')
      await expect(page.locator(`[data-testid="menu-category-row-${bId}"]:visible`)).toBeVisible()

      // Chromium automation doesn't raise HTML5 drag events from synthetic
      // mouse movement, so the sequence is dispatched directly with a shared
      // DataTransfer. Firing them back-to-back also pins the regression that
      // made this necessary: the drop handler must read its drag source from
      // a ref, since batched state would still be null at this point.
      await page.evaluate(
        ([srcSel, tgtSel]) => {
          const src = document.querySelector(srcSel)!
          const tgt = document.querySelector(tgtSel)!
          const dt = new DataTransfer()
          src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }))
          tgt.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }))
          tgt.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }))
          src.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }))
        },
        [`[data-testid="menu-category-row-${bId}"]`, `[data-testid="menu-category-row-${aId}"]`],
      )

      await expect(async () => {
        const rows = await allCategoriesOrdered()
        const names = rows.map((c) => c.name_nl)
        expect(names.indexOf(`${PREFIX}dragB`)).toBeLessThan(names.indexOf(`${PREFIX}dragA`))
        expect(rows.map((c) => c.display_order)).toEqual(rows.map((_, i) => i))
      }).toPass({ timeout: 15_000 })
    } finally {
      await cleanupSeededMenu(seeded)
      await cleanupD42TestCategories(TEST_RESTAURANT_ID)
      await restoreCategoryOrder(snapshot)
    }
  })

  test('reorder rejects malformed orderings', async ({ page }) => {
    test.setTimeout(60_000)
    const snapshot = await snapshotCategoryOrder(TEST_RESTAURANT_ID)

    try {
      await signInAsTestOwner(page)
      const all = await allCategoriesOrdered()
      const ids = all.map((c) => c.id as string)

      const incomplete = await page.request.post('/api/dashboard/menu/categories/reorder', {
        data: { ordered_ids: ids.slice(0, ids.length - 1) },
      })
      expect(incomplete.status()).toBe(400)
      expect((await incomplete.json()).error).toBe('incomplete_order')

      const duplicate = await page.request.post('/api/dashboard/menu/categories/reorder', {
        data: { ordered_ids: [...ids.slice(0, ids.length - 1), ids[0]] },
      })
      expect(duplicate.status()).toBe(400)
      expect((await duplicate.json()).error).toBe('duplicate_id')

      const unknown = await page.request.post('/api/dashboard/menu/categories/reorder', {
        data: { ordered_ids: [...ids.slice(0, ids.length - 1), '11111111-1111-4111-8111-111111111111'] },
      })
      expect(unknown.status()).toBe(400)
      expect((await unknown.json()).error).toBe('unknown_category')

      const empty = await page.request.post('/api/dashboard/menu/categories/reorder', {
        data: { ordered_ids: [] },
      })
      expect(empty.status()).toBe(400)
      expect((await empty.json()).error).toBe('invalid_body')

      // Nothing moved.
      const after = await allCategoriesOrdered()
      expect(after.map((c) => c.id)).toEqual(all.map((c) => c.id))
    } finally {
      await restoreCategoryOrder(snapshot)
    }
  })

  test('hiding a category hides its items on the consumer QR menu', async ({ page }) => {
    test.setTimeout(90_000)
    const seeded = await seedMenu({
      restaurantId: TEST_RESTAURANT_ID,
      categories: [
        {
          name: `${PREFIX}hide`,
          displayOrder: 220,
          items: [{ name: `${PREFIX}hidden_item`, priceCents: 700 }],
        },
      ],
    })
    const categoryId = seeded.categoryIds[0]

    try {
      await signInAsTestOwner(page)

      const qrUrl = `/r/${TEST_RESTAURANT_SLUG}/qr/${TEST_RESTAURANT_TABLE_QR_TOKEN}/menu`
      await page.goto(qrUrl)
      await expect(page.getByText(`${PREFIX}hidden_item`)).toBeVisible()

      await page.goto('/dashboard/menu')
      await page.locator(`[data-testid="menu-category-edit-${categoryId}"]:visible`).click()
      await page.locator('[data-testid="category-visible-qr"]').uncheck()
      await page.locator('[data-testid="category-submit"]').click()
      await expect(page.locator('[data-testid="category-edit-dialog"]')).toHaveCount(0, { timeout: 10_000 })

      // Category header AND its item both disappear — fetchMenu drives the
      // render off visible categories, so hiding one suppresses its items.
      await page.goto(qrUrl)
      await expect(page.getByText(`${PREFIX}hide`, { exact: true })).toHaveCount(0)
      await expect(page.getByText(`${PREFIX}hidden_item`)).toHaveCount(0)

      await page.goto('/dashboard/menu')
      await page.locator(`[data-testid="menu-category-edit-${categoryId}"]:visible`).click()
      await page.locator('[data-testid="category-visible-qr"]').check()
      await page.locator('[data-testid="category-submit"]').click()
      await expect(page.locator('[data-testid="category-edit-dialog"]')).toHaveCount(0, { timeout: 10_000 })

      await page.goto(qrUrl)
      await expect(page.getByText(`${PREFIX}hidden_item`)).toBeVisible()
    } finally {
      await cleanupSeededMenu(seeded)
      await cleanupD42TestCategories(TEST_RESTAURANT_ID)
    }
  })
})
