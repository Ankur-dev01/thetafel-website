import { test, expect } from '../fixtures/base'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { adminClient, TEST_RESTAURANT_ID, wipeTestRestaurantPhotos } from '../fixtures/test-restaurant'
import { signInAsTestOwner } from '../fixtures/dashboard-auth'
import { seedMenu, cleanupSeededMenu, cleanupMenuCategoriesByPrefix } from '../fixtures/seed-menu'

// D4.4 — photo upload. Every test seeds its own throwaway category+item under
// a `_D44_test_` prefix and cleans both the rows and the bucket objects in
// `finally`; `wipeTestRestaurantPhotos()` sweeps the restaurant's storage
// folder, which nothing did before this unit.

const PHOTOS = join(process.cwd(), 'tests/e2e/fixtures/photos')
const VALID = join(PHOTOS, 'valid.jpg')
const TINY = join(PHOTOS, 'tiny.png')
const SLIVER = join(PHOTOS, 'sliver.jpg')
const CORRUPT = join(PHOTOS, 'corrupt.png')

async function getItem(itemId: string) {
  const { data } = await adminClient().from('menu_items').select('*').eq('id', itemId).maybeSingle()
  return data
}

async function objectExists(key: string): Promise<boolean> {
  const { data } = await adminClient()
    .storage.from('menu-photos')
    .list(key.substring(0, key.lastIndexOf('/')), { search: key.substring(key.lastIndexOf('/') + 1) })
  return (data ?? []).length > 0
}

async function auditRows(itemId: string, eventType: string) {
  const { data } = await adminClient()
    .from('dashboard_audit_logs')
    .select('*')
    .eq('event_type', eventType)
    .eq('restaurant_id', TEST_RESTAURANT_ID)
  return (data ?? []).filter((r) => (r.event_data as { item_id?: string })?.item_id === itemId)
}

async function seedItem(name: string, displayOrder: number) {
  return seedMenu({
    restaurantId: TEST_RESTAURANT_ID,
    categories: [{ name: `_D44_test_cat_${displayOrder}`, displayOrder, items: [{ name, priceCents: 1200 }] }],
  })
}

/** Direct multipart POST, bypassing the UI — used for the server-side rejection cases. */
async function postPhoto(page: import('@playwright/test').Page, itemId: string, filePath: string, mimeType: string) {
  return page.request.post(`/api/dashboard/menu/items/${itemId}/photo/upload`, {
    multipart: {
      photo: { name: filePath.split(/[\\/]/).pop()!, mimeType, buffer: readFileSync(filePath) },
    },
  })
}

test.describe('Menu item photo upload (D4.4)', () => {
  // Per-test `finally` cleanup can be cut short by a timeout, and a stray
  // category is not harmless here: D4.2's delete route renumbers every
  // remaining category, so a leak surfaces as an ordering failure in an
  // unrelated spec. Sweep by prefix as well.
  test.afterAll(async () => {
    await cleanupMenuCategoriesByPrefix(TEST_RESTAURANT_ID, '_D44_test_')
    await wipeTestRestaurantPhotos()
  })

  test('upload photo happy path', async ({ page }) => {
    test.setTimeout(90_000)
    const seeded = await seedItem('_D44_test_photo1', 141)
    const itemId = seeded.itemIds[0]

    try {
      await signInAsTestOwner(page)
      await page.goto(`/dashboard/menu?item=${itemId}`)

      await page.locator('[data-testid="menu-item-photo-replace"]:visible').click()
      await expect(page.locator('[data-testid="photo-upload-dialog"]')).toBeVisible()

      await page.locator('[data-testid="photo-upload-file-input"]').setInputFiles(VALID)
      await expect(page.locator('[data-testid="photo-upload-preview"]')).toBeVisible()
      await page.locator('[data-testid="photo-upload-submit"]').click()

      await expect(page.locator('[data-testid="photo-upload-dialog"]')).toHaveCount(0, { timeout: 30_000 })

      await expect(async () => {
        const item = await getItem(itemId)
        expect(item?.photo_path).toBeTruthy()
        expect(item?.photo_thumb_path).toBeTruthy()
      }).toPass({ timeout: 15_000 })

      const item = await getItem(itemId)
      // Restaurant-scoped folder, item-scoped name, WebP regardless of input format.
      expect(item!.photo_path).toMatch(new RegExp(`^${TEST_RESTAURANT_ID}/${itemId}-[0-9a-f-]{36}\\.webp$`))
      expect(item!.photo_thumb_path).toMatch(new RegExp(`^${TEST_RESTAURANT_ID}/${itemId}-[0-9a-f-]{36}-thumb\\.webp$`))
      expect(await objectExists(item!.photo_path)).toBe(true)
      expect(await objectExists(item!.photo_thumb_path)).toBe(true)

      const rows = await auditRows(itemId, 'menu.item.photo_uploaded')
      expect(rows.length).toBe(1)
      expect(rows[0].event_data.actual_mime).toBe('image/jpeg')
      expect(rows[0].event_data.width).toBe(800)
      expect(rows[0].event_data.height).toBe(600)
    } finally {
      await cleanupSeededMenu(seeded)
      await wipeTestRestaurantPhotos()
    }
  })

  test('replace deletes the previous objects', async ({ page }) => {
    test.setTimeout(150_000)
    const seeded = await seedItem('_D44_test_replace', 142)
    const itemId = seeded.itemIds[0]

    try {
      await signInAsTestOwner(page)

      const first = await postPhoto(page, itemId, VALID, 'image/jpeg')
      expect(first.status()).toBe(200)
      const firstBody = await first.json()

      const second = await postPhoto(page, itemId, VALID, 'image/jpeg')
      expect(second.status()).toBe(200)
      const secondBody = await second.json()

      expect(secondBody.photo_path).not.toBe(firstBody.photo_path)

      const item = await getItem(itemId)
      expect(item!.photo_path).toBe(secondBody.photo_path)

      // Old pair swept, new pair present.
      expect(await objectExists(firstBody.photo_path)).toBe(false)
      expect(await objectExists(firstBody.photo_thumb_path)).toBe(false)
      expect(await objectExists(secondBody.photo_path)).toBe(true)

      const rows = await auditRows(itemId, 'menu.item.photo_uploaded')
      const replaceRow = rows.find((r) => r.event_data.old_photo_path === firstBody.photo_path)
      expect(replaceRow).toBeTruthy()
    } finally {
      await cleanupSeededMenu(seeded)
      await wipeTestRestaurantPhotos()
    }
  })

  test('reference-count guard keeps an object a second item still uses', async ({ page }) => {
    test.setTimeout(150_000)
    const seeded = await seedMenu({
      restaurantId: TEST_RESTAURANT_ID,
      categories: [
        {
          name: '_D44_test_cat_shared',
          displayOrder: 143,
          items: [
            { name: '_D44_test_shared_a', priceCents: 1000 },
            { name: '_D44_test_shared_b', priceCents: 1000 },
          ],
        },
      ],
    })
    const [itemA, itemB] = seeded.itemIds

    try {
      await signInAsTestOwner(page)

      const first = await postPhoto(page, itemA, VALID, 'image/jpeg')
      expect(first.status()).toBe(200)
      const shared = await first.json()

      // Point B at the same objects — the shape the legacy seed script produced.
      await adminClient()
        .from('menu_items')
        .update({ photo_path: shared.photo_path, photo_thumb_path: shared.photo_thumb_path })
        .eq('id', itemB)

      // Replacing A's photo must NOT delete objects B still references.
      const second = await postPhoto(page, itemA, VALID, 'image/jpeg')
      expect(second.status()).toBe(200)

      expect((await getItem(itemB))!.photo_path).toBe(shared.photo_path)
      expect(await objectExists(shared.photo_path)).toBe(true)
      expect(await objectExists(shared.photo_thumb_path)).toBe(true)

      const rows = await auditRows(itemA, 'menu.item.photo_uploaded')
      const guarded = rows.find((r) => (r.event_data.kept_shared ?? []).includes(shared.photo_path))
      expect(guarded).toBeTruthy()
    } finally {
      await cleanupSeededMenu(seeded)
      await wipeTestRestaurantPhotos()
    }
  })

  test('delete photo clears columns and objects', async ({ page }) => {
    test.setTimeout(120_000)
    const seeded = await seedItem('_D44_test_delete', 144)
    const itemId = seeded.itemIds[0]

    try {
      await signInAsTestOwner(page)
      const uploaded = await postPhoto(page, itemId, VALID, 'image/jpeg')
      expect(uploaded.status()).toBe(200)
      const body = await uploaded.json()

      await page.goto(`/dashboard/menu?item=${itemId}`)
      await page.locator('[data-testid="menu-item-photo-delete"]:visible').click()
      await page.getByRole('alertdialog').getByRole('button', { name: 'Ja, verwijder' }).click()

      await expect(async () => {
        const item = await getItem(itemId)
        expect(item?.photo_path).toBeNull()
        expect(item?.photo_thumb_path).toBeNull()
      }).toPass({ timeout: 15_000 })

      // The route nulls the columns before it removes the objects, so polling
      // the DB can win the race against the storage call still in flight.
      // Retry rather than assert once.
      await expect(async () => {
        expect(await objectExists(body.photo_path)).toBe(false)
        expect(await objectExists(body.photo_thumb_path)).toBe(false)
      }).toPass({ timeout: 20_000 })

      expect((await auditRows(itemId, 'menu.item.photo_deleted')).length).toBe(1)
    } finally {
      await cleanupSeededMenu(seeded)
      await wipeTestRestaurantPhotos()
    }
  })

  test('delete on an item with no photo is a no-op, not an error', async ({ page }) => {
    test.setTimeout(60_000)
    const seeded = await seedItem('_D44_test_noop', 145)
    const itemId = seeded.itemIds[0]

    try {
      await signInAsTestOwner(page)
      const res = await page.request.post(`/api/dashboard/menu/items/${itemId}/photo/delete`, { data: {} })
      expect(res.status()).toBe(200)
      expect((await res.json()).noop).toBe(true)
    } finally {
      await cleanupSeededMenu(seeded)
      await wipeTestRestaurantPhotos()
    }
  })

  test('oversized file is rejected with no storage write', async ({ page }) => {
    test.setTimeout(90_000)
    const seeded = await seedItem('_D44_test_toolarge', 146)
    const itemId = seeded.itemIds[0]

    try {
      await signInAsTestOwner(page)
      // Built at runtime rather than committing a 6 MB binary.
      const oversized = Buffer.alloc(6 * 1024 * 1024, 0x7f)
      Buffer.from([0xff, 0xd8, 0xff]).copy(oversized, 0)

      const res = await page.request.post(`/api/dashboard/menu/items/${itemId}/photo/upload`, {
        multipart: { photo: { name: 'huge.jpg', mimeType: 'image/jpeg', buffer: oversized } },
      })
      expect(res.status()).toBe(400)
      expect((await res.json()).error).toBe('too_large')

      const item = await getItem(itemId)
      expect(item?.photo_path).toBeNull()
    } finally {
      await cleanupSeededMenu(seeded)
      await wipeTestRestaurantPhotos()
    }
  })

  test('text file renamed .png is rejected on magic bytes', async ({ page }) => {
    test.setTimeout(60_000)
    const seeded = await seedItem('_D44_test_corrupt', 147)
    const itemId = seeded.itemIds[0]

    try {
      await signInAsTestOwner(page)
      const res = await postPhoto(page, itemId, CORRUPT, 'image/png')
      expect(res.status()).toBe(400)
      expect((await res.json()).error).toBe('mime_mismatch')
      expect((await getItem(itemId))?.photo_path).toBeNull()
    } finally {
      await cleanupSeededMenu(seeded)
      await wipeTestRestaurantPhotos()
    }
  })

  test('under-sized image is rejected', async ({ page }) => {
    test.setTimeout(60_000)
    const seeded = await seedItem('_D44_test_tiny', 148)
    const itemId = seeded.itemIds[0]

    try {
      await signInAsTestOwner(page)
      const res = await postPhoto(page, itemId, TINY, 'image/png')
      expect(res.status()).toBe(400)
      expect((await res.json()).error).toBe('too_small')
      expect((await getItem(itemId))?.photo_path).toBeNull()
    } finally {
      await cleanupSeededMenu(seeded)
      await wipeTestRestaurantPhotos()
    }
  })

  test('extreme aspect ratio is rejected', async ({ page }) => {
    test.setTimeout(60_000)
    const seeded = await seedItem('_D44_test_sliver', 149)
    const itemId = seeded.itemIds[0]

    try {
      await signInAsTestOwner(page)
      const res = await postPhoto(page, itemId, SLIVER, 'image/jpeg')
      expect(res.status()).toBe(400)
      expect((await res.json()).error).toBe('bad_aspect_ratio')
      expect((await getItem(itemId))?.photo_path).toBeNull()
    } finally {
      await cleanupSeededMenu(seeded)
      await wipeTestRestaurantPhotos()
    }
  })

  test('unknown item id 404s and writes nothing to storage', async ({ page }) => {
    test.setTimeout(60_000)
    await signInAsTestOwner(page)

    const before = await adminClient().storage.from('menu-photos').list(TEST_RESTAURANT_ID)
    const res = await postPhoto(page, '00000000-0000-4000-8000-000000000000', VALID, 'image/jpeg')
    expect(res.status()).toBe(404)
    expect((await res.json()).error).toBe('not_found')

    // The existence check runs before any storage call, so the folder is untouched.
    const after = await adminClient().storage.from('menu-photos').list(TEST_RESTAURANT_ID)
    expect((after.data ?? []).length).toBe((before.data ?? []).length)
  })

  test('card renders the thumbnail, detail renders the full image', async ({ page }) => {
    test.setTimeout(90_000)
    const seeded = await seedItem('_D44_test_thumb', 150)
    const itemId = seeded.itemIds[0]
    const categoryId = seeded.categoryIds[0]

    try {
      await signInAsTestOwner(page)
      const uploaded = await postPhoto(page, itemId, VALID, 'image/jpeg')
      expect(uploaded.status()).toBe(200)
      const body = await uploaded.json()

      await page.goto(`/dashboard/menu?category=${categoryId}`)
      const cardImg = page.locator(`[data-testid="menu-item-${itemId}"]:visible img`)
      await expect(cardImg).toHaveAttribute('src', new RegExp(body.photo_thumb_path.split('/').pop()!))

      await page.goto(`/dashboard/menu?item=${itemId}`)
      const detailImg = page.locator('[data-testid="menu-item-detail-desktop"]:visible img').first()
      await expect(detailImg).toHaveAttribute('src', new RegExp(body.photo_path.split('/').pop()!))
    } finally {
      await cleanupSeededMenu(seeded)
      await wipeTestRestaurantPhotos()
    }
  })
})
