// GET /api/dashboard/menu
//   (menu.read — owner/manager; starter+ i.e. no plan gate — menu is a core
//   feature available on every tier.)
//
// Thin wrapper around the existing website Menu RSC helper
// `getMenuPayload`. ZERO new DB queries, ZERO new business logic — the exact
// categories / items the Menu RSC page renders are what mobile receives.
//
// The one adaptation this route performs is a shape mapping: the website
// helper returns camelCase fields (lib/dashboard/queries/menu.ts), while the
// mobile client's `MenuPayload` (thetafel-mobile/src/lib/menu/types.ts) uses
// snake_case fields derived directly from the database columns. The mapping
// below is 1:1 and intentionally dumb — no filtering, no aggregation, no
// localisation choice beyond defaulting to 'nl' at the HTTP boundary
// (matches the Analytics route's convention for a locale-less mobile
// request; mobile stays bilingual by reading `name_nl` / `name_en`).

import { NextResponse, type NextRequest } from 'next/server'

import { resolveFeatureContext, NO_STORE } from '@/lib/dashboard/guests/guard'
import {
  getMenuPayload,
  type MenuCategory as ServerMenuCategory,
  type MenuItem as ServerMenuItem,
} from '@/lib/dashboard/queries/menu'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  const resolved = await resolveFeatureContext('menu.read', 'starter', { write: false })
  if (!resolved.ok) return resolved.response
  const { restaurantId } = resolved.ctx

  // Locale picks the display `name` field only; the raw `nameNl`/`nameEn`
  // pairs are returned alongside, so the mobile client stays bilingual.
  const payload = await getMenuPayload(restaurantId, 'nl')

  return NextResponse.json(
    {
      categories: payload.categories.map(mapCategory),
      items: payload.items.map(mapItem),
      totals: payload.totals,
    },
    { headers: NO_STORE },
  )
}

// ── Shape mapping (camelCase → mobile snake_case) ─────────────────────────
// Fields are 1:1 renames. Any field the mobile type expects but the server
// doesn't compute (e.g. `category_name` on items — the server already
// resolves this via a joined read) is sourced from the matching server
// field, never fabricated.

function mapCategory(c: ServerMenuCategory) {
  return {
    id: c.id,
    name_nl: c.nameNl,
    name_en: c.nameEn,
    display_order: c.displayOrder,
    window_start: c.windowStart,
    window_end: c.windowEnd,
    visible_takeaway: c.visibleTakeaway,
    visible_qr: c.visibleQr,
    item_count: c.itemCount,
  }
}

function mapItem(i: ServerMenuItem) {
  return {
    id: i.id,
    category_id: i.categoryId,
    category_name: i.categoryName,
    name_nl: i.nameNl,
    name_en: i.nameEn,
    description_nl: i.descriptionNl,
    description_en: i.descriptionEn,
    price_cents: i.priceCents,
    currency: i.currency,
    vat_rate_bp: i.vatRateBp,
    dietary_tags: i.dietaryTags,
    available: i.available,
    visible_takeaway: i.visibleTakeaway,
    visible_qr: i.visibleQr,
    photo_url: i.photoUrl,
    photo_path: i.photoPath,
    photo_thumb_url: i.photoThumbUrl,
    photo_thumb_path: i.photoThumbPath,
    display_order: i.displayOrder,
  }
}
