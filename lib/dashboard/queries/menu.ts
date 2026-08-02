import 'server-only'

import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * Menu query helpers (D4.1). Session client throughout — RLS's
 * `menu_cats_owner_all` / `menu_items_owner_all` policies grant the owner
 * full SELECT (including unavailable items, any visibility state); the
 * `restaurant_id` filter here is belt-and-braces on top of that.
 *
 * Column names are the live schema, not the D4.1 plan's assumptions:
 * bilingual `name_nl`/`name_en` (no single `name`, no `slug`) on both
 * tables, no `description` on categories at all, and `menu_items.allergens`
 * exists but is entirely unpopulated — real allergen/diet info lives in the
 * single `dietary_tags` array, split via lib/menu/allergens.ts's
 * `splitTags()` (same helper the consumer QR menu uses).
 */

export type MenuCategory = {
  id: string
  /** Locale-picked, for display. The raw pair below is what the D4.2 edit dialog round-trips. */
  name: string
  nameNl: string
  nameEn: string | null
  displayOrder: number | null
  windowStart: string | null
  windowEnd: string | null
  visibleTakeaway: boolean
  visibleQr: boolean
  itemCount: number
}

export type MenuItem = {
  id: string
  categoryId: string | null
  categoryName: string | null
  name: string
  description: string | null
  priceCents: number
  currency: string
  dietaryTags: string[]
  available: boolean
  photoUrl: string | null
  displayOrder: number | null
}

export type MenuItemVariant = {
  id: string
  name: string
  priceDeltaCents: number
}

export type MenuItemDetail = MenuItem & {
  categoryWindowStart: string | null
  categoryWindowEnd: string | null
  createdAt: string
  updatedAt: string
  variants: MenuItemVariant[]
}

export type MenuPayload = {
  categories: MenuCategory[]
  items: MenuItem[]
  totals: { categories: number; items: number; unavailable: number }
}

type CategoryRow = {
  id: string
  name_nl: string
  name_en: string | null
  display_order: number | null
  window_start: string | null
  window_end: string | null
  visible_takeaway: boolean
  visible_qr: boolean
}

type ItemRow = {
  id: string
  category_id: string | null
  name_nl: string
  name_en: string | null
  description_nl: string | null
  description_en: string | null
  price_cents: number
  currency: string
  dietary_tags: string[] | null
  available: boolean
  photo_path: string | null
  display_order: number | null
  category: { name_nl: string; name_en: string | null } | null
}

function pickLocalised(nl: string, en: string | null, locale: 'nl' | 'en'): string {
  if (locale === 'en' && en) return en
  return nl
}

function pickLocalisedNullable(nl: string | null, en: string | null, locale: 'nl' | 'en'): string | null {
  if (locale === 'en' && en) return en
  return nl
}

/** Public URL for a menu item photo — same bucket/pattern as lib/menu/fetchMenu.ts's consumer render path. */
function photoUrlFor(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, photoPath: string | null): string | null {
  if (!photoPath) return null
  return supabase.storage.from('menu-photos').getPublicUrl(photoPath).data.publicUrl
}

export async function getMenuCategories(restaurantId: string, locale: 'nl' | 'en'): Promise<MenuCategory[]> {
  const supabase = await createSupabaseServerClient()

  const [{ data: categoryRows, error: categoryError }, { data: itemRows, error: itemError }] = await Promise.all([
    supabase
      .from('menu_categories')
      .select('id, name_nl, name_en, display_order, window_start, window_end, visible_takeaway, visible_qr')
      .eq('restaurant_id', restaurantId)
      .order('display_order', { ascending: true, nullsFirst: false })
      .order('name_nl', { ascending: true }),
    supabase.from('menu_items').select('category_id').eq('restaurant_id', restaurantId),
  ])
  if (categoryError) throw categoryError
  if (itemError) throw itemError

  const counts = new Map<string, number>()
  for (const row of (itemRows ?? []) as { category_id: string | null }[]) {
    if (!row.category_id) continue
    counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1)
  }

  return ((categoryRows ?? []) as CategoryRow[]).map((row) => ({
    id: row.id,
    name: pickLocalised(row.name_nl, row.name_en, locale),
    nameNl: row.name_nl,
    nameEn: row.name_en,
    displayOrder: row.display_order,
    windowStart: row.window_start,
    windowEnd: row.window_end,
    visibleTakeaway: row.visible_takeaway,
    visibleQr: row.visible_qr,
    itemCount: counts.get(row.id) ?? 0,
  }))
}

export type GetMenuItemsOpts = {
  categoryId?: string
  search?: string
}

export async function getMenuItems(restaurantId: string, locale: 'nl' | 'en', opts: GetMenuItemsOpts = {}): Promise<MenuItem[]> {
  const supabase = await createSupabaseServerClient()

  let query = supabase
    .from('menu_items')
    .select(
      `id, category_id, name_nl, name_en, description_nl, description_en, price_cents, currency,
       dietary_tags, available, photo_path, display_order,
       category:menu_categories(name_nl, name_en)`,
    )
    .eq('restaurant_id', restaurantId)

  if (opts.categoryId) {
    query = query.eq('category_id', opts.categoryId)
  }
  const search = opts.search?.trim()
  if (search) {
    // Bilingual name search — an nl-only match still surfaces items titled only in English and vice versa.
    query = query.or(`name_nl.ilike.%${search}%,name_en.ilike.%${search}%`)
  }

  const { data, error } = await query.order('display_order', { ascending: true, nullsFirst: false }).order('name_nl', { ascending: true })
  if (error) throw error

  return ((data ?? []) as unknown as ItemRow[]).map((row) => ({
    id: row.id,
    categoryId: row.category_id,
    categoryName: row.category ? pickLocalised(row.category.name_nl, row.category.name_en, locale) : null,
    name: pickLocalised(row.name_nl, row.name_en, locale),
    description: pickLocalisedNullable(row.description_nl, row.description_en, locale),
    priceCents: row.price_cents,
    currency: row.currency,
    dietaryTags: row.dietary_tags ?? [],
    available: row.available,
    photoUrl: photoUrlFor(supabase, row.photo_path),
    displayOrder: row.display_order,
  }))
}

export async function getMenuItemDetail(restaurantId: string, itemId: string, locale: 'nl' | 'en'): Promise<MenuItemDetail | null> {
  const supabase = await createSupabaseServerClient()

  const { data: row, error } = await supabase
    .from('menu_items')
    .select(
      `id, category_id, name_nl, name_en, description_nl, description_en, price_cents, currency,
       dietary_tags, available, photo_path, display_order, created_at, updated_at,
       category:menu_categories(name_nl, name_en, window_start, window_end)`,
    )
    .eq('id', itemId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle()
  if (error) throw error
  if (!row) return null

  type RawRow = ItemRow & {
    created_at: string
    updated_at: string
    category: { name_nl: string; name_en: string | null; window_start: string | null; window_end: string | null } | null
  }
  const item = row as unknown as RawRow

  const { data: variantRows, error: variantError } = await supabase
    .from('menu_item_variants')
    .select('id, name_nl, price_delta_cents')
    .eq('item_id', itemId)
    .order('created_at', { ascending: true })
  if (variantError) throw variantError

  return {
    id: item.id,
    categoryId: item.category_id,
    categoryName: item.category ? pickLocalised(item.category.name_nl, item.category.name_en, locale) : null,
    name: pickLocalised(item.name_nl, item.name_en, locale),
    description: pickLocalisedNullable(item.description_nl, item.description_en, locale),
    priceCents: item.price_cents,
    currency: item.currency,
    dietaryTags: item.dietary_tags ?? [],
    available: item.available,
    photoUrl: photoUrlFor(supabase, item.photo_path),
    displayOrder: item.display_order,
    categoryWindowStart: item.category?.window_start ?? null,
    categoryWindowEnd: item.category?.window_end ?? null,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    variants: (variantRows ?? []).map((v) => ({
      id: v.id as string,
      name: v.name_nl as string,
      priceDeltaCents: v.price_delta_cents as number,
    })),
  }
}

export async function getMenuPayload(restaurantId: string, locale: 'nl' | 'en', opts: GetMenuItemsOpts = {}): Promise<MenuPayload> {
  const [categories, items, allItems] = await Promise.all([
    getMenuCategories(restaurantId, locale),
    getMenuItems(restaurantId, locale, opts),
    getMenuItems(restaurantId, locale, {}),
  ])

  return {
    categories,
    items,
    totals: {
      categories: categories.length,
      items: allItems.length,
      unavailable: allItems.filter((i) => !i.available).length,
    },
  }
}
