import { test, expect } from '../fixtures/base'
import { TEST_RESTAURANT_ID } from '../fixtures/test-restaurant'
import { signInAsTestOwner } from '../fixtures/dashboard-auth'
import { seedMenu, cleanupSeededMenu, fakePhotoPath } from '../fixtures/seed-menu'

// The test restaurant carries a small PERMANENT menu (3 categories / 6
// items) that other specs order real items from by name (see
// tests/e2e/qr/pay-at-table.spec.ts) — it is never wiped. Every test here
// seeds its own categories/items alongside it (high display_order so they
// don't collide with the default-landing-category behavior) and deletes
// exactly what it created in `finally`. A true "zero categories" empty-state
// test isn't reachable against this shared fixture — Test 1 below covers the
// empty state that IS reachable instead (an empty category), same
// documented-constraint pattern as the D3.2 cross-restaurant test.

test.describe('Menu page — categories, items, search, detail (D4.1)', () => {
  test('empty category shows its own empty state', async ({ page }) => {
    test.setTimeout(60_000)
    const seeded = await seedMenu({
      restaurantId: TEST_RESTAURANT_ID,
      categories: [{ name: 'E2E Empty Category', displayOrder: 101, items: [] }],
    })

    try {
      await signInAsTestOwner(page)
      await page.goto(`/dashboard/menu?category=${seeded.categoryIds[0]}`)

      await expect(page.locator('h2:visible', { hasText: 'Geen items in deze categorie' })).toHaveCount(1)
      // `menu-item-row-` (the card wrapper), not `menu-item-` — the latter is
      // also a prefix of D4.3's `menu-item-add` button, which is present and
      // enabled precisely when the category IS empty.
      await expect(page.locator('[data-testid^="menu-item-row-"]:visible')).toHaveCount(0)
    } finally {
      await cleanupSeededMenu(seeded)
    }
  })

  test('categories render with counts + windows', async ({ page }) => {
    test.setTimeout(60_000)
    const seeded = await seedMenu({
      restaurantId: TEST_RESTAURANT_ID,
      categories: [
        {
          name: 'E2E Voorgerechten',
          displayOrder: 102,
          items: Array.from({ length: 4 }, (_, i) => ({ name: `E2E Voor ${i + 1}`, priceCents: 500 })),
        },
        {
          name: 'E2E Lunch',
          displayOrder: 103,
          windowStart: '12:00:00',
          windowEnd: '15:00:00',
          items: Array.from({ length: 2 }, (_, i) => ({ name: `E2E Lunch ${i + 1}`, priceCents: 800 })),
        },
        {
          name: 'E2E Dranken',
          displayOrder: 104,
          items: Array.from({ length: 8 }, (_, i) => ({ name: `E2E Drank ${i + 1}`, priceCents: 300 })),
        },
      ],
    })
    const [voorId, lunchId, drankenId] = seeded.categoryIds

    try {
      await signInAsTestOwner(page)
      await page.goto(`/dashboard/menu?category=${voorId}`)

      await expect(page.locator(`[data-testid="menu-category-${voorId}"]`)).toContainText('(4)')
      await expect(page.locator(`[data-testid="menu-category-${lunchId}"]`)).toContainText('(2)')
      await expect(page.locator(`[data-testid="menu-category-${drankenId}"]`)).toContainText('(8)')
      await expect(page.locator(`[data-testid="menu-category-${lunchId}"]`)).toContainText('12:00 – 15:00')
    } finally {
      await cleanupSeededMenu(seeded)
    }
  })

  test('category selection scopes the item grid and survives refresh', async ({ page }) => {
    test.setTimeout(60_000)
    const seeded = await seedMenu({
      restaurantId: TEST_RESTAURANT_ID,
      categories: [
        { name: 'E2E Cat A', displayOrder: 105, items: [{ name: 'E2E Item A1', priceCents: 500 }] },
        {
          name: 'E2E Cat B',
          displayOrder: 106,
          items: [
            { name: 'E2E Item B1', priceCents: 600 },
            { name: 'E2E Item B2', priceCents: 700 },
          ],
        },
      ],
    })
    const [catAId, catBId] = seeded.categoryIds
    const [itemA1Id, itemB1Id, itemB2Id] = seeded.itemIds

    try {
      await signInAsTestOwner(page)
      await page.goto(`/dashboard/menu?category=${catAId}`)

      await expect(page.locator(`[data-testid="menu-item-${itemA1Id}"]:visible`)).toHaveCount(1)
      await expect(page.locator(`[data-testid="menu-item-${itemB1Id}"]:visible`)).toHaveCount(0)

      await page.locator(`[data-testid="menu-category-${catBId}"]`).click()
      await expect(page).toHaveURL(new RegExp(`category=${catBId}`))
      await expect(page.locator(`[data-testid="menu-item-${itemB1Id}"]:visible`)).toHaveCount(1)
      await expect(page.locator(`[data-testid="menu-item-${itemB2Id}"]:visible`)).toHaveCount(1)
      await expect(page.locator(`[data-testid="menu-item-${itemA1Id}"]:visible`)).toHaveCount(0)

      await page.reload()
      await expect(page.locator(`[data-testid="menu-item-${itemB1Id}"]:visible`)).toHaveCount(1)
      await expect(page.locator(`[data-testid="menu-item-${itemA1Id}"]:visible`)).toHaveCount(0)
    } finally {
      await cleanupSeededMenu(seeded)
    }
  })

  test('item detail via ?item shows full fields and its action buttons', async ({ page }) => {
    test.setTimeout(60_000)
    const seeded = await seedMenu({
      restaurantId: TEST_RESTAURANT_ID,
      categories: [
        {
          name: 'E2E Detail Category',
          displayOrder: 107,
          items: [
            {
              name: 'E2E Detail Item',
              description: 'A full description for the detail panel.',
              priceCents: 1250,
              dietaryTags: ['vegetarian', 'contains_dairy'],
            },
          ],
        },
      ],
    })
    const itemId = seeded.itemIds[0]

    try {
      await signInAsTestOwner(page)
      await page.goto(`/dashboard/menu?item=${itemId}`)

      const panel = page.locator('[data-testid="menu-item-detail-desktop"]:visible, [data-testid="menu-item-detail-phone"]:visible')
      await expect(panel.getByText('E2E Detail Item').first()).toBeVisible()
      await expect(panel.getByText('12,50', { exact: false }).first()).toBeVisible()
      await expect(panel.getByText('A full description for the detail panel.')).toBeVisible()
      await expect(panel.getByText('VEGETARISCH')).toBeVisible()
      await expect(panel.getByText('Bevat zuivel')).toBeVisible()

      // D4.3 activated edit + 86, and D4.4 activated the photo action, so all
      // three of D4.1's stubs are now live buttons.
      const editBtn = page.locator('[data-testid="menu-item-detail-edit"]:visible')
      const toggleBtn = page.locator('[data-testid="menu-item-detail-toggle86"]:visible')
      const photoBtn = page.locator('[data-testid="menu-item-photo-replace"]:visible')
      await expect(editBtn).toBeEnabled()
      await expect(toggleBtn).toBeEnabled()
      await expect(photoBtn).toBeEnabled()
      // No photo on this seeded item, so the delete action isn't offered.
      await expect(page.locator('[data-testid="menu-item-photo-delete"]')).toHaveCount(0)
    } finally {
      await cleanupSeededMenu(seeded)
    }
  })

  test('86\'d item renders greyed with the unavailable chip', async ({ page }) => {
    test.setTimeout(60_000)
    const seeded = await seedMenu({
      restaurantId: TEST_RESTAURANT_ID,
      categories: [
        {
          name: 'E2E 86 Category',
          displayOrder: 108,
          items: [{ name: 'E2E 86 Item', priceCents: 900, available: false }],
        },
      ],
    })
    const categoryId = seeded.categoryIds[0]
    const itemId = seeded.itemIds[0]

    try {
      await signInAsTestOwner(page)
      await page.goto(`/dashboard/menu?category=${categoryId}`)

      // The greying lives on the card wrapper; `menu-item-{id}` is the inner
      // link D4.3 split out so the row's action buttons sit outside it.
      const card = page.locator(`[data-testid="menu-item-row-${itemId}"]:visible`)
      await expect(card).toHaveCount(1)
      await expect(card).toHaveClass(/opacity-60/)
      await expect(card.getByText("86'd")).toBeVisible()
    } finally {
      await cleanupSeededMenu(seeded)
    }
  })

  test('search finds items across categories', async ({ page }) => {
    test.setTimeout(60_000)
    const seeded = await seedMenu({
      restaurantId: TEST_RESTAURANT_ID,
      categories: [
        { name: 'E2E Search Cat A', displayOrder: 109, items: [{ name: 'E2E Bitterballen', priceCents: 650 }] },
        { name: 'E2E Search Cat B', displayOrder: 110, items: [{ name: 'E2E Bittere Chocolademousse', priceCents: 550 }] },
      ],
    })
    const [item1Id, item2Id] = seeded.itemIds

    try {
      await signInAsTestOwner(page)
      await page.goto('/dashboard/menu')

      await page.locator('[data-testid="menu-search"]:visible').first().fill('E2E Bitter')
      await expect(page).toHaveURL(/q=/, { timeout: 5_000 })

      await expect(page.locator(`[data-testid="menu-item-${item1Id}"]:visible`)).toHaveCount(1)
      await expect(page.locator(`[data-testid="menu-item-${item2Id}"]:visible`)).toHaveCount(1)

      await page.locator('[data-testid="menu-search"]:visible').first().fill('')
      await expect(page).not.toHaveURL(/q=/, { timeout: 5_000 })
    } finally {
      await cleanupSeededMenu(seeded)
    }
  })

  test('image render path: with and without a photo', async ({ page }) => {
    test.setTimeout(60_000)
    const seeded = await seedMenu({
      restaurantId: TEST_RESTAURANT_ID,
      categories: [
        {
          name: 'E2E Photo Category',
          displayOrder: 111,
          items: [
            { name: 'E2E With Photo', priceCents: 400, photoPath: fakePhotoPath() },
            { name: 'E2E Without Photo', priceCents: 400 },
          ],
        },
      ],
    })
    const categoryId = seeded.categoryIds[0]
    const [withPhotoId, withoutPhotoId] = seeded.itemIds

    try {
      await signInAsTestOwner(page)
      await page.goto(`/dashboard/menu?category=${categoryId}`)

      const withPhotoCard = page.locator(`[data-testid="menu-item-${withPhotoId}"]:visible`)
      const img = withPhotoCard.locator('img')
      await expect(img).toHaveCount(1)
      const src = await img.getAttribute('src')
      expect(src).toBeTruthy()
      expect(src).toContain('menu-photos')

      const withoutPhotoCard = page.locator(`[data-testid="menu-item-${withoutPhotoId}"]:visible`)
      await expect(withoutPhotoCard.locator('img')).toHaveCount(0)
      await expect(withoutPhotoCard.locator('svg')).toHaveCount(1)
    } finally {
      await cleanupSeededMenu(seeded)
    }
  })
})
