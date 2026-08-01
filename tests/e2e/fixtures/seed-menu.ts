import { randomUUID } from 'node:crypto'
import { adminClient } from './test-restaurant'

export type SeedMenuItemSpec = {
  name: string
  description?: string
  priceCents: number
  dietaryTags?: string[]
  available?: boolean // default true
  photoPath?: string // storage path under the menu-photos bucket; omit for no image
}

export type SeedMenuCategorySpec = {
  name: string
  displayOrder?: number
  windowStart?: string // 'HH:MM:SS'
  windowEnd?: string
  items: SeedMenuItemSpec[]
}

/**
 * Seeds categories + items for tests/e2e/dashboard/menu-list.spec.ts.
 * Admin client — bypasses RLS. Deliberately does NOT touch (or get swept by)
 * wipeTestRestaurant(): the test restaurant already carries a small
 * permanent menu (3 categories / 6 items) that other specs order real items
 * from by name (e.g. tests/e2e/qr/pay-at-table.spec.ts). This only ever adds
 * alongside that menu — callers must delete exactly what they created, via
 * the returned ids, in their own `finally`.
 */
export async function seedMenu(opts: {
  restaurantId: string
  categories: SeedMenuCategorySpec[]
}): Promise<{ categoryIds: string[]; itemIds: string[] }> {
  const supabase = adminClient()
  const categoryIds: string[] = []
  const itemIds: string[] = []

  for (const categorySpec of opts.categories) {
    const { data: category, error: categoryError } = await supabase
      .from('menu_categories')
      .insert({
        restaurant_id: opts.restaurantId,
        name_nl: categorySpec.name,
        display_order: categorySpec.displayOrder ?? 100,
        window_start: categorySpec.windowStart ?? null,
        window_end: categorySpec.windowEnd ?? null,
      })
      .select('id')
      .single()
    if (categoryError || !category) throw new Error(`[seedMenu] category insert failed: ${categoryError?.message}`)
    const categoryId = category.id as string
    categoryIds.push(categoryId)

    for (const itemSpec of categorySpec.items) {
      const { data: item, error: itemError } = await supabase
        .from('menu_items')
        .insert({
          restaurant_id: opts.restaurantId,
          category_id: categoryId,
          name_nl: itemSpec.name,
          description_nl: itemSpec.description ?? null,
          price_cents: itemSpec.priceCents,
          dietary_tags: itemSpec.dietaryTags ?? [],
          available: itemSpec.available ?? true,
          photo_path: itemSpec.photoPath ?? null,
        })
        .select('id')
        .single()
      if (itemError || !item) throw new Error(`[seedMenu] item insert failed: ${itemError?.message}`)
      itemIds.push(item.id as string)
    }
  }

  return { categoryIds, itemIds }
}

/** A syntactically-valid storage path — getPublicUrl() builds a URL string without checking the object exists, so no real upload is needed to test the render path. */
export function fakePhotoPath(): string {
  return `e2e/${randomUUID()}.jpg`
}

/** Deletes exactly the rows `seedMenu` created — items first (FK), then categories. */
export async function cleanupSeededMenu(ids: { categoryIds: string[]; itemIds: string[] }): Promise<void> {
  const supabase = adminClient()
  if (ids.itemIds.length > 0) {
    await supabase.from('menu_items').delete().in('id', ids.itemIds)
  }
  if (ids.categoryIds.length > 0) {
    await supabase.from('menu_categories').delete().in('id', ids.categoryIds)
  }
}
