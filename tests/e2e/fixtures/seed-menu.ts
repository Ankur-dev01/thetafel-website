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

/**
 * The test restaurant's permanent menu, which is never wiped and which
 * tests/e2e/qr/pay-at-table.spec.ts reads by name AND by position — it picks
 * the first item card under a category heading, so item display_order is
 * load-bearing there.
 *
 * D4.2's reorder route rewrites EVERY category of the restaurant, so any test
 * that reorders must put these three back afterwards.
 */
export const PERMANENT_CATEGORY_ORDER: { name_nl: string; display_order: number }[] = [
  { name_nl: 'Voorgerechten', display_order: 0 },
  { name_nl: 'Hoofdgerechten', display_order: 1 },
  { name_nl: 'Desserts', display_order: 2 },
]

/** Snapshot every category's display_order, so a reorder test can put things back exactly. */
export async function snapshotCategoryOrder(
  restaurantId: string,
): Promise<{ id: string; display_order: number | null }[]> {
  const supabase = adminClient()
  const { data, error } = await supabase
    .from('menu_categories')
    .select('id, display_order')
    .eq('restaurant_id', restaurantId)
  if (error) throw new Error(`[snapshotCategoryOrder] failed: ${error.message}`)
  return (data ?? []).map((r) => ({ id: r.id as string, display_order: r.display_order as number | null }))
}

/** Restore a snapshot taken by `snapshotCategoryOrder`. Rows that no longer exist are skipped. */
export async function restoreCategoryOrder(
  snapshot: { id: string; display_order: number | null }[],
): Promise<void> {
  const supabase = adminClient()
  for (const row of snapshot) {
    await supabase.from('menu_categories').update({ display_order: row.display_order }).eq('id', row.id)
  }
}

/**
 * Snapshot one category's item ordering. Needed because
 * tests/e2e/qr/pay-at-table.spec.ts picks the FIRST item card under a
 * category heading — item display_order is load-bearing there, so any test
 * that reorders permanent items must restore it.
 */
export async function snapshotItemOrder(
  restaurantId: string,
  categoryId: string,
): Promise<{ id: string; display_order: number | null }[]> {
  const supabase = adminClient()
  const { data, error } = await supabase
    .from('menu_items')
    .select('id, display_order')
    .eq('restaurant_id', restaurantId)
    .eq('category_id', categoryId)
  if (error) throw new Error(`[snapshotItemOrder] failed: ${error.message}`)
  return (data ?? []).map((r) => ({ id: r.id as string, display_order: r.display_order as number | null }))
}

/** Restore a snapshot taken by `snapshotItemOrder`. Rows that no longer exist are skipped. */
export async function restoreItemOrder(
  snapshot: { id: string; display_order: number | null }[],
): Promise<void> {
  const supabase = adminClient()
  for (const row of snapshot) {
    await supabase.from('menu_items').update({ display_order: row.display_order }).eq('id', row.id)
  }
}

/** Deletes any `_D43_test_%` items (and their variants, via FK cascade) left behind by a failed D4.3 test. */
export async function cleanupD43TestItems(restaurantId: string): Promise<void> {
  const supabase = adminClient()
  await supabase
    .from('menu_items')
    .delete()
    .eq('restaurant_id', restaurantId)
    .like('name_nl', '\\_D43\\_test\\_%')
  const { data: categories } = await supabase
    .from('menu_categories')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .like('name_nl', '\\_D43\\_test\\_%')
  const ids = (categories ?? []).map((c) => c.id as string)
  if (ids.length > 0) {
    await supabase.from('menu_items').delete().in('category_id', ids)
    await supabase.from('menu_categories').delete().in('id', ids)
  }
}

/** Deletes any `_D42_test_%` categories (and their items) left behind by a failed D4.2 test. */
export async function cleanupD42TestCategories(restaurantId: string): Promise<void> {
  const supabase = adminClient()
  const { data: categories } = await supabase
    .from('menu_categories')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .like('name_nl', '\\_D42\\_test\\_%')
  const ids = (categories ?? []).map((c) => c.id as string)
  if (ids.length === 0) return
  await supabase.from('menu_items').delete().in('category_id', ids)
  await supabase.from('menu_categories').delete().in('id', ids)
}
