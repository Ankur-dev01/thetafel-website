import { createHash, randomBytes } from 'node:crypto'

import { test, expect } from '../fixtures/base'
import { TEST_RESTAURANT_ID, TEST_RESTAURANT_SLUG, TEST_RESTAURANT_TABLE_QR_TOKEN, adminClient } from '../fixtures/test-restaurant'
import { signInAsTestOwner } from '../fixtures/dashboard-auth'
import {
  seedMenu,
  cleanupSeededMenu,
  cleanupD43TestItems,
  snapshotItemOrder,
  restoreItemOrder,
} from '../fixtures/seed-menu'

// Everything is scoped to `_D43_test_*` rows seeded alongside the test
// restaurant's permanent menu, which is never wiped (pay-at-table.spec.ts
// reads it by name AND by position). The reorder test snapshots the target
// category's item order and restores it in `finally`.

const PREFIX = '_D43_test_'
const VOORGERECHTEN = '98634eeb-26d7-497f-bdf2-bba2f7667a37'

async function getItemByName(nameNl: string) {
  const { data } = await adminClient()
    .from('menu_items')
    .select('*')
    .eq('restaurant_id', TEST_RESTAURANT_ID)
    .eq('name_nl', nameNl)
    .maybeSingle()
  return data
}

async function getItemById(id: string) {
  const { data } = await adminClient().from('menu_items').select('*').eq('id', id).maybeSingle()
  return data
}

async function getAuditRows(eventType: string) {
  const { data } = await adminClient()
    .from('dashboard_audit_logs')
    .select('*')
    .eq('restaurant_id', TEST_RESTAURANT_ID)
    .eq('event_type', eventType)
    .order('created_at', { ascending: false })
  return data ?? []
}

async function itemsInCategory(categoryId: string) {
  const { data } = await adminClient()
    .from('menu_items')
    .select('id, name_nl, display_order')
    .eq('restaurant_id', TEST_RESTAURANT_ID)
    .eq('category_id', categoryId)
    .order('display_order', { ascending: true })
  return data ?? []
}

async function openCreateDialog(page: import('@playwright/test').Page) {
  await page.locator('[data-testid="menu-item-add"]:visible').first().click()
  await expect(page.locator('[data-testid="item-edit-dialog"]')).toBeVisible()
}

test.describe('Menu item CRUD (D4.3)', () => {
  test.afterAll(async () => {
    await cleanupD43TestItems(TEST_RESTAURANT_ID)
  })

  test('create item with only the required fields', async ({ page }) => {
    test.setTimeout(60_000)
    const name = `${PREFIX}alpha`

    try {
      await signInAsTestOwner(page)
      await page.goto(`/dashboard/menu?category=${VOORGERECHTEN}`)

      const before = await itemsInCategory(VOORGERECHTEN)
      await openCreateDialog(page)
      await page.locator('#item-name-nl').fill(name)
      await page.locator('[data-testid="item-price"]').fill('5,00')
      await page.locator('[data-testid="item-submit"]').click()
      await expect(page.locator('[data-testid="item-edit-dialog"]')).toHaveCount(0, { timeout: 10_000 })

      const row = await getItemByName(name)
      expect(row).toBeTruthy()
      expect(row!.price_cents).toBe(500)
      expect(row!.name_en).toBeNull()
      expect(row!.description_nl).toBeNull()
      expect(row!.vat_rate_bp).toBe(900)
      expect(row!.dietary_tags).toEqual([])
      expect(row!.available).toBe(true)
      expect(row!.visible_qr).toBe(true)
      expect(row!.visible_takeaway).toBe(true)
      expect(row!.category_id).toBe(VOORGERECHTEN)
      expect(row!.display_order).toBe(before.length)

      const audits = await getAuditRows('menu.item.created')
      expect(audits.some((a) => a.event_data.item_id === row!.id)).toBe(true)
    } finally {
      await cleanupD43TestItems(TEST_RESTAURANT_ID)
    }
  })

  test('create item with every field, tags stored in canonical order', async ({ page }) => {
    test.setTimeout(60_000)
    const name = `${PREFIX}full`

    try {
      await signInAsTestOwner(page)
      await page.goto(`/dashboard/menu?category=${VOORGERECHTEN}`)
      await openCreateDialog(page)

      await page.locator('#item-name-nl').fill(name)
      await page.locator('#item-name-en').fill('Full Item')
      await page.locator('#item-description-nl').fill('Nederlandse omschrijving.')
      await page.locator('#item-description-en').fill('English description.')
      await page.locator('[data-testid="item-price"]').fill('12,50')
      // Click diet before allergen: canonical order must still put the
      // allergen first, proving the picker's click order never reaches the DB.
      await page.locator('[data-testid="tag-diet-vegetarian"]').click()
      await page.locator('[data-testid="tag-allergen-contains_dairy"]').click()
      await page.locator('[data-testid="vat-option-2100"]').check()
      await page.locator('[data-testid="item-submit"]').click()
      await expect(page.locator('[data-testid="item-edit-dialog"]')).toHaveCount(0, { timeout: 10_000 })

      const row = await getItemByName(name)
      expect(row).toBeTruthy()
      expect(row!.name_en).toBe('Full Item')
      expect(row!.description_nl).toBe('Nederlandse omschrijving.')
      expect(row!.description_en).toBe('English description.')
      expect(row!.price_cents).toBe(1250)
      expect(row!.vat_rate_bp).toBe(2100)
      expect(row!.dietary_tags).toEqual(['contains_dairy', 'vegetarian'])
    } finally {
      await cleanupD43TestItems(TEST_RESTAURANT_ID)
    }
  })

  test('validation errors, client and server', async ({ page }) => {
    test.setTimeout(60_000)

    try {
      await signInAsTestOwner(page)
      await page.goto(`/dashboard/menu?category=${VOORGERECHTEN}`)
      await openCreateDialog(page)
      const dialog = page.locator('[data-testid="item-edit-dialog"]')

      // Empty name.
      await page.locator('[data-testid="item-price"]').fill('5,00')
      await page.locator('[data-testid="item-submit"]').click()
      await expect(dialog.getByText('Nederlandse naam is verplicht.')).toBeVisible()

      // Over-long name.
      await page.locator('#item-name-nl').fill('x'.repeat(81))
      await page.locator('[data-testid="item-submit"]').click()
      await expect(dialog.getByText('Naam is te lang (max 80 tekens).')).toBeVisible()

      // Over-long description.
      await page.locator('#item-name-nl').fill(`${PREFIX}valid`)
      await page.locator('#item-description-nl').fill('y'.repeat(501))
      await page.locator('[data-testid="item-submit"]').click()
      await expect(dialog.getByText('Omschrijving is te lang (max 500 tekens).')).toBeVisible()

      const base = {
        category_id: VOORGERECHTEN,
        name_nl: `${PREFIX}srv`,
        name_en: null,
        description_nl: null,
        description_en: null,
        price_cents: 500,
        vat_rate_bp: 900,
        dietary_tags: [] as string[],
        visible_takeaway: true,
        visible_qr: true,
        available: true,
      }

      // €0.00 is valid (tap water, complimentary bread).
      const zero = await page.request.post('/api/dashboard/menu/items/create', {
        data: { ...base, name_nl: `${PREFIX}zero`, price_cents: 0 },
      })
      expect(zero.status()).toBe(200)

      const negative = await page.request.post('/api/dashboard/menu/items/create', {
        data: { ...base, price_cents: -1 },
      })
      expect(negative.status()).toBe(400)
      expect((await negative.json()).errors).toContainEqual({ field: 'price_cents', code: 'price_negative' })

      const emptyName = await page.request.post('/api/dashboard/menu/items/create', {
        data: { ...base, name_nl: '' },
      })
      expect(emptyName.status()).toBe(400)
      expect((await emptyName.json()).errors).toContainEqual({ field: 'name_nl', code: 'name_nl_required' })

      const badVat = await page.request.post('/api/dashboard/menu/items/create', {
        data: { ...base, vat_rate_bp: 1500 },
      })
      expect(badVat.status()).toBe(400)
      expect((await badVat.json()).errors).toContainEqual({ field: 'vat_rate_bp', code: 'vat_invalid' })

      const badTag = await page.request.post('/api/dashboard/menu/items/create', {
        data: { ...base, dietary_tags: ['not_a_real_tag'] },
      })
      expect(badTag.status()).toBe(400)
      expect((await badTag.json()).errors).toContainEqual({ field: 'dietary_tags', code: 'tag_unknown' })
    } finally {
      await cleanupD43TestItems(TEST_RESTAURANT_ID)
    }
  })

  test('alcohol + 9% VAT shows a non-blocking warning', async ({ page }) => {
    test.setTimeout(60_000)
    const name = `${PREFIX}booze`

    try {
      await signInAsTestOwner(page)
      await page.goto(`/dashboard/menu?category=${VOORGERECHTEN}`)
      await openCreateDialog(page)

      await page.locator('#item-name-nl').fill(name)
      await page.locator('[data-testid="item-price"]').fill('7,00')
      await expect(page.locator('[data-testid="vat-alcohol-warning"]')).toHaveCount(0)

      await page.locator('[data-testid="tag-allergen-contains_alcohol"]').click()
      await expect(page.locator('[data-testid="vat-alcohol-warning"]')).toBeVisible()

      await page.locator('[data-testid="vat-option-2100"]').check()
      await expect(page.locator('[data-testid="vat-alcohol-warning"]')).toHaveCount(0)

      await page.locator('[data-testid="item-submit"]').click()
      await expect(page.locator('[data-testid="item-edit-dialog"]')).toHaveCount(0, { timeout: 10_000 })

      const row = await getItemByName(name)
      expect(row!.vat_rate_bp).toBe(2100)
      expect(row!.dietary_tags).toEqual(['contains_alcohol'])
    } finally {
      await cleanupD43TestItems(TEST_RESTAURANT_ID)
    }
  })

  test('edit item records a field-level audit diff', async ({ page }) => {
    test.setTimeout(60_000)
    const seeded = await seedMenu({
      restaurantId: TEST_RESTAURANT_ID,
      categories: [
        { name: `${PREFIX}edit_cat`, displayOrder: 300, items: [{ name: `${PREFIX}edit_me`, priceCents: 800 }] },
      ],
    })
    const itemId = seeded.itemIds[0]

    try {
      await signInAsTestOwner(page)
      await page.goto(`/dashboard/menu?category=${seeded.categoryIds[0]}`)

      await page.locator(`[data-testid="menu-item-edit-${itemId}"]:visible`).click()
      await expect(page.locator('[data-testid="item-edit-dialog"]')).toBeVisible()

      await page.locator('#item-name-nl').fill(`${PREFIX}edited`)
      await page.locator('[data-testid="item-price"]').fill('9,95')
      await page.locator('[data-testid="tag-diet-vegan"]').click()
      await page.locator('[data-testid="item-submit"]').click()
      await expect(page.locator('[data-testid="item-edit-dialog"]')).toHaveCount(0, { timeout: 10_000 })

      const row = await getItemById(itemId)
      expect(row!.name_nl).toBe(`${PREFIX}edited`)
      expect(row!.price_cents).toBe(995)
      expect(row!.dietary_tags).toEqual(['vegan'])

      const audit = (await getAuditRows('menu.item.updated')).find((a) => a.event_data.item_id === itemId)
      expect(audit).toBeTruthy()
      expect(Object.keys(audit!.event_data.changes).sort()).toEqual(['dietary_tags', 'name_nl', 'price_cents'])
    } finally {
      await cleanupSeededMenu(seeded)
      await cleanupD43TestItems(TEST_RESTAURANT_ID)
    }
  })

  test('re-parenting an item appends it and renumbers the old category', async ({ page }) => {
    test.setTimeout(60_000)
    const seeded = await seedMenu({
      restaurantId: TEST_RESTAURANT_ID,
      categories: [
        {
          name: `${PREFIX}cat_A`,
          displayOrder: 310,
          items: [
            { name: `${PREFIX}a1`, priceCents: 100 },
            { name: `${PREFIX}a2`, priceCents: 200 },
            { name: `${PREFIX}a3`, priceCents: 300 },
          ],
        },
        { name: `${PREFIX}cat_B`, displayOrder: 311, items: [{ name: `${PREFIX}b1`, priceCents: 400 }] },
      ],
    })
    const [catA, catB] = seeded.categoryIds
    const movingId = seeded.itemIds[0] // a1, display_order 0 in A

    try {
      await signInAsTestOwner(page)

      const res = await page.request.post(`/api/dashboard/menu/items/${movingId}/update`, {
        data: {
          category_id: catB,
          name_nl: `${PREFIX}a1`,
          name_en: null,
          description_nl: null,
          description_en: null,
          price_cents: 100,
          vat_rate_bp: 900,
          dietary_tags: [],
          visible_takeaway: true,
          visible_qr: true,
          available: true,
        },
      })
      expect(res.status()).toBe(200)

      const moved = await getItemById(movingId)
      expect(moved!.category_id).toBe(catB)
      expect(moved!.display_order).toBe(1) // appended after b1

      const remainingA = await itemsInCategory(catA)
      expect(remainingA.map((i) => i.display_order)).toEqual(remainingA.map((_, i) => i))
      expect(remainingA.map((i) => i.name_nl)).toEqual([`${PREFIX}a2`, `${PREFIX}a3`])
    } finally {
      await cleanupSeededMenu(seeded)
      await cleanupD43TestItems(TEST_RESTAURANT_ID)
    }
  })

  test('deleting an item leaves past order history intact', async ({ page }) => {
    test.setTimeout(60_000)
    const seeded = await seedMenu({
      restaurantId: TEST_RESTAURANT_ID,
      categories: [
        { name: `${PREFIX}hist_cat`, displayOrder: 320, items: [{ name: `${PREFIX}sold_dish`, priceCents: 1850 }] },
      ],
    })
    const itemId = seeded.itemIds[0]
    const supabase = adminClient()

    // A completed order that referenced the item, exactly as the real order
    // flow writes it: FK plus independent snapshot columns.
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        restaurant_id: TEST_RESTAURANT_ID,
        order_ref: `D43-${Date.now().toString(36).toUpperCase()}`,
        order_type: 'qr',
        status: 'completed',
        payment_status: 'paid',
        subtotal_cents: 1850,
        vat_cents: 0,
        total_cents: 1850,
        table_id: '4d1bbbe1-a3a4-46ce-a0e9-2aed3556ad91',
        magic_link_token_hash: createHash('sha256').update(randomBytes(32)).digest('hex'),
      })
      .select('id')
      .single()
    if (orderError || !order) throw new Error(`[D43] order insert failed: ${orderError?.message}`)

    const { data: orderItem, error: orderItemError } = await supabase
      .from('order_items')
      .insert({
        order_id: order.id,
        menu_item_id: itemId,
        name_snapshot: `${PREFIX}sold_dish`,
        unit_price_cents: 1850,
        quantity: 2,
        line_total_cents: 3700,
      })
      .select('id')
      .single()
    if (orderItemError || !orderItem) throw new Error(`[D43] order_item insert failed: ${orderItemError?.message}`)

    try {
      await signInAsTestOwner(page)

      const res = await page.request.post(`/api/dashboard/menu/items/${itemId}/delete`, { data: {} })
      expect(res.status()).toBe(200)

      expect(await getItemById(itemId)).toBeNull()

      const { data: historical } = await supabase.from('order_items').select('*').eq('id', orderItem.id).single()
      expect(historical.menu_item_id).toBeNull() // ON DELETE SET NULL fired
      expect(historical.name_snapshot).toBe(`${PREFIX}sold_dish`) // history survives
      expect(historical.unit_price_cents).toBe(1850)
      expect(historical.quantity).toBe(2)
      expect(historical.line_total_cents).toBe(3700)

      // And the dashboard still renders the line from the snapshot.
      await page.goto(`/dashboard/orders?order=${order.id}`)
      await expect(page.getByText(`${PREFIX}sold_dish`).first()).toBeVisible()
    } finally {
      await supabase.from('order_items').delete().eq('order_id', order.id)
      await supabase.from('orders').delete().eq('id', order.id)
      await cleanupSeededMenu(seeded)
      await cleanupD43TestItems(TEST_RESTAURANT_ID)
    }
  })

  test('86 toggle hides the item from the consumer QR menu', async ({ page }) => {
    test.setTimeout(90_000)
    const seeded = await seedMenu({
      restaurantId: TEST_RESTAURANT_ID,
      categories: [
        { name: `${PREFIX}86_cat`, displayOrder: 330, items: [{ name: `${PREFIX}86_dish`, priceCents: 700 }] },
      ],
    })
    const categoryId = seeded.categoryIds[0]
    const itemId = seeded.itemIds[0]
    const qrUrl = `/r/${TEST_RESTAURANT_SLUG}/qr/${TEST_RESTAURANT_TABLE_QR_TOKEN}/menu`

    try {
      await signInAsTestOwner(page)
      await page.goto(qrUrl)
      await expect(page.getByText(`${PREFIX}86_dish`)).toBeVisible()

      await page.goto(`/dashboard/menu?category=${categoryId}`)
      await page.locator(`[data-testid="menu-item-toggle86-${itemId}"]:visible`).click()

      await expect(async () => {
        expect((await getItemById(itemId))!.available).toBe(false)
      }).toPass({ timeout: 10_000 })

      const audit = (await getAuditRows('menu.item.availability_changed')).find((a) => a.event_data.item_id === itemId)
      expect(audit!.event_data.from).toBe(true)
      expect(audit!.event_data.to).toBe(false)

      await page.goto(qrUrl)
      await expect(page.getByText(`${PREFIX}86_dish`)).toHaveCount(0)

      // Back on.
      await page.goto(`/dashboard/menu?category=${categoryId}`)
      await page.locator(`[data-testid="menu-item-toggle86-${itemId}"]:visible`).click()
      await expect(async () => {
        expect((await getItemById(itemId))!.available).toBe(true)
      }).toPass({ timeout: 10_000 })

      await page.goto(qrUrl)
      await expect(page.getByText(`${PREFIX}86_dish`)).toBeVisible()
    } finally {
      await cleanupSeededMenu(seeded)
      await cleanupD43TestItems(TEST_RESTAURANT_ID)
    }
  })

  test('86 toggle is idempotent when the state already matches', async ({ page }) => {
    test.setTimeout(60_000)
    const seeded = await seedMenu({
      restaurantId: TEST_RESTAURANT_ID,
      categories: [
        { name: `${PREFIX}idem_cat`, displayOrder: 335, items: [{ name: `${PREFIX}idem`, priceCents: 500 }] },
      ],
    })
    const itemId = seeded.itemIds[0]

    try {
      await signInAsTestOwner(page)
      const before = (await getAuditRows('menu.item.availability_changed')).length

      const res = await page.request.post(`/api/dashboard/menu/items/${itemId}/toggle-86`, {
        data: { available: true }, // already true
      })
      expect(res.status()).toBe(200)
      expect((await res.json()).changed).toBe(false)

      expect((await getAuditRows('menu.item.availability_changed')).length).toBe(before)
    } finally {
      await cleanupSeededMenu(seeded)
      await cleanupD43TestItems(TEST_RESTAURANT_ID)
    }
  })

  test('per-surface visibility hides the item from QR only', async ({ page }) => {
    test.setTimeout(90_000)
    const seeded = await seedMenu({
      restaurantId: TEST_RESTAURANT_ID,
      categories: [
        { name: `${PREFIX}vis_cat`, displayOrder: 340, items: [{ name: `${PREFIX}vis_dish`, priceCents: 600 }] },
      ],
    })
    const itemId = seeded.itemIds[0]
    const qrUrl = `/r/${TEST_RESTAURANT_SLUG}/qr/${TEST_RESTAURANT_TABLE_QR_TOKEN}/menu`

    try {
      await signInAsTestOwner(page)
      await page.goto(qrUrl)
      await expect(page.getByText(`${PREFIX}vis_dish`)).toBeVisible()

      const res = await page.request.post(`/api/dashboard/menu/items/${itemId}/toggle-visibility`, {
        data: { visible_qr: false },
      })
      expect(res.status()).toBe(200)
      expect((await res.json()).changed).toBe(true)

      const row = await getItemById(itemId)
      expect(row!.visible_qr).toBe(false)
      expect(row!.visible_takeaway).toBe(true) // untouched

      await page.goto(qrUrl)
      await expect(page.getByText(`${PREFIX}vis_dish`)).toHaveCount(0)

      // Re-asserting the same value is a no-op, not an error.
      const repeat = await page.request.post(`/api/dashboard/menu/items/${itemId}/toggle-visibility`, {
        data: { visible_qr: false },
      })
      expect(repeat.status()).toBe(200)
      expect((await repeat.json()).changed).toBe(false)
    } finally {
      await cleanupSeededMenu(seeded)
      await cleanupD43TestItems(TEST_RESTAURANT_ID)
    }
  })

  test('reorder renumbers a category densely and restores cleanly', async ({ page }) => {
    test.setTimeout(90_000)
    const snapshot = await snapshotItemOrder(TEST_RESTAURANT_ID, VOORGERECHTEN)
    const seeded = await seedMenu({
      restaurantId: TEST_RESTAURANT_ID,
      categories: [{ name: `${PREFIX}reorder_holder`, displayOrder: 350, items: [] }],
    })
    const created: string[] = []
    const supabase = adminClient()
    for (const suffix of ['r1', 'r2', 'r3']) {
      const { data } = await supabase
        .from('menu_items')
        .insert({
          restaurant_id: TEST_RESTAURANT_ID,
          category_id: VOORGERECHTEN,
          name_nl: `${PREFIX}${suffix}`,
          price_cents: 500,
          display_order: 90 + created.length,
        })
        .select('id')
        .single()
      created.push(data!.id as string)
    }

    try {
      await signInAsTestOwner(page)

      const all = await itemsInCategory(VOORGERECHTEN)
      const ids = all.map((i) => i.id as string)
      // Move the last seeded item to the front.
      const moved = [created[2], ...ids.filter((id) => id !== created[2])]

      const res = await page.request.post('/api/dashboard/menu/items/reorder', {
        data: { category_id: VOORGERECHTEN, ordered_ids: moved },
      })
      expect(res.status()).toBe(200)

      const after = await itemsInCategory(VOORGERECHTEN)
      expect(after.map((i) => i.display_order)).toEqual(after.map((_, i) => i))
      expect(after.map((i) => i.id)).toEqual(moved)

      const audit = (await getAuditRows('menu.item.reordered'))[0]
      expect(audit.event_data.category_id).toBe(VOORGERECHTEN)
      expect(audit.event_data.new_order).toHaveLength(moved.length)
    } finally {
      await supabase.from('menu_items').delete().in('id', created)
      await cleanupSeededMenu(seeded)
      await cleanupD43TestItems(TEST_RESTAURANT_ID)
      await restoreItemOrder(snapshot)
    }
  })

  test('reorder rejects malformed orderings', async ({ page }) => {
    test.setTimeout(60_000)
    const snapshot = await snapshotItemOrder(TEST_RESTAURANT_ID, VOORGERECHTEN)

    try {
      await signInAsTestOwner(page)
      const all = await itemsInCategory(VOORGERECHTEN)
      const ids = all.map((i) => i.id as string)

      const incomplete = await page.request.post('/api/dashboard/menu/items/reorder', {
        data: { category_id: VOORGERECHTEN, ordered_ids: ids.slice(0, ids.length - 1) },
      })
      expect(incomplete.status()).toBe(400)
      expect((await incomplete.json()).error).toBe('incomplete_order')

      const duplicate = await page.request.post('/api/dashboard/menu/items/reorder', {
        data: { category_id: VOORGERECHTEN, ordered_ids: [...ids.slice(0, ids.length - 1), ids[0]] },
      })
      expect(duplicate.status()).toBe(400)
      expect((await duplicate.json()).error).toBe('duplicate_id')

      const unknownItem = await page.request.post('/api/dashboard/menu/items/reorder', {
        data: {
          category_id: VOORGERECHTEN,
          ordered_ids: [...ids.slice(0, ids.length - 1), '11111111-1111-4111-8111-111111111111'],
        },
      })
      expect(unknownItem.status()).toBe(400)
      expect((await unknownItem.json()).error).toBe('unknown_item')

      const unknownCategory = await page.request.post('/api/dashboard/menu/items/reorder', {
        data: { category_id: '11111111-1111-4111-8111-111111111111', ordered_ids: ids },
      })
      expect(unknownCategory.status()).toBe(400)
      expect((await unknownCategory.json()).error).toBe('unknown_category')

      const after = await itemsInCategory(VOORGERECHTEN)
      expect(after.map((i) => i.id)).toEqual(all.map((i) => i.id))
    } finally {
      await restoreItemOrder(snapshot)
    }
  })
})
