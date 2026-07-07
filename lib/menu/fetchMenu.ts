import 'server-only'
import { cache } from 'react'
import { createSupabasePublicClient } from '@/lib/consumer/supabasePublic'
import type { MenuCategory, MenuContext, MenuData, MenuItem } from './types'

type CategoryRow = {
  id: string
  name_nl: string
  name_en: string | null
  display_order: number
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
  vat_rate_bp: number
  photo_path: string | null
  available: boolean
  display_order: number
  dietary_tags: string[] | null
}

function pickLocalised(
  nl: string,
  en: string | null,
  locale: 'nl' | 'en'
): string {
  if (locale === 'en' && en) return en
  return nl
}

function pickLocalisedNullable(
  nl: string | null,
  en: string | null,
  locale: 'nl' | 'en'
): string | null {
  if (locale === 'en' && en) return en
  return nl
}

/**
 * Fetch a restaurant's menu for a given context and locale, ready to render.
 *
 * Two round-trips (categories, then items) rather than a single embedded
 * query: the FK direction is items → categories, and orphaned items
 * (category_id = null) are deliberately excluded.
 */
export const fetchMenu = cache(
  async (
    restaurantId: string,
    context: MenuContext,
    locale: 'nl' | 'en'
  ): Promise<MenuData> => {
    const supabase = createSupabasePublicClient()
    const visibilityCol = context === 'qr' ? 'visible_qr' : 'visible_takeaway'

    const [categoriesRes, itemsRes] = await Promise.all([
      supabase
        .from('menu_categories')
        .select('id, name_nl, name_en, display_order')
        .eq('restaurant_id', restaurantId)
        .eq(visibilityCol, true)
        .order('display_order', { ascending: true }),
      supabase
        .from('menu_items')
        .select(
          'id, category_id, name_nl, name_en, description_nl, description_en, price_cents, currency, vat_rate_bp, photo_path, available, display_order, dietary_tags'
        )
        .eq('restaurant_id', restaurantId)
        .eq(visibilityCol, true)
        .eq('available', true)
        .order('display_order', { ascending: true }),
    ])

    if (categoriesRes.error) {
      console.error('[fetchMenu] categories query failed', {
        restaurantId,
        error: categoriesRes.error,
      })
    }
    if (itemsRes.error) {
      console.error('[fetchMenu] items query failed', {
        restaurantId,
        error: itemsRes.error,
      })
    }

    const categoryRows = (categoriesRes.data ?? []) as CategoryRow[]
    const itemRows = (itemsRes.data ?? []) as ItemRow[]

    const itemsByCategory = new Map<string, MenuItem[]>()
    for (const row of itemRows) {
      if (!row.category_id) continue

      let photoUrl: string | null = null
      if (row.photo_path) {
        photoUrl = supabase.storage
          .from('menu-photos')
          .getPublicUrl(row.photo_path).data.publicUrl
      }

      const item: MenuItem = {
        id: row.id,
        categoryId: row.category_id,
        name: pickLocalised(row.name_nl, row.name_en, locale),
        description: pickLocalisedNullable(
          row.description_nl,
          row.description_en,
          locale
        ),
        priceCents: row.price_cents,
        currency: row.currency,
        vatRateBp: row.vat_rate_bp,
        photoUrl,
        dietaryTags: row.dietary_tags ?? [],
        available: row.available,
        displayOrder: row.display_order,
      }

      const bucket = itemsByCategory.get(row.category_id)
      if (bucket) {
        bucket.push(item)
      } else {
        itemsByCategory.set(row.category_id, [item])
      }
    }

    const categories: MenuCategory[] = categoryRows
      .map((row) => ({
        id: row.id,
        name: pickLocalised(row.name_nl, row.name_en, locale),
        displayOrder: row.display_order,
        items: itemsByCategory.get(row.id) ?? [],
      }))
      .filter((category) => category.items.length > 0)

    return {
      restaurantId,
      context,
      locale,
      categories,
    }
  }
)
