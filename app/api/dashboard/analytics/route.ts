// GET /api/dashboard/analytics?range=7|30|90|custom&from=&to=
//   (insights.read — owner/manager; Plus+. Revenue / breakdown / no-show cost
//   require Premium.)
//
// Thin wrapper around the existing website Analytics helpers. ZERO new
// business logic — every number comes from `compute*` / `loadInsightData`
// just like app/[locale]/dashboard/analytics/page.tsx uses them. The only
// transform here is turning the RevenueDims Map lookups into the already-
// defined JSON-compatible RevenueSplit[] shapes via the existing helpers
// revenueByTable / revenueByCategory. Returns `isPremium` on every response
// so the mobile client can render the correct Revenue state without needing
// a separate tier endpoint.

import { NextResponse, type NextRequest } from 'next/server'

import { resolveFeatureContext, NO_STORE } from '@/lib/dashboard/guests/guard'
import {
  loadInsightData,
  loadRevenueDims,
  parseRange,
} from '@/lib/dashboard/insights/queries'
import {
  computeNoShowCost,
  computeOccupancy,
  computeOrders,
  computePatterns,
  computeRevenue,
  computeTopDishes,
  revenueByCategory,
  revenueByTable,
} from '@/lib/dashboard/insights/compute'
import { tierAtLeast } from '@/lib/dashboard/tier'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Reuses the same preamble as the Guests surface: session (Bearer OR cookie
  // via createSupabaseServerClient) → acting restaurant → `insights.read`
  // role gate → Plus tier gate. On non-Plus, this returns `upgrade_required`
  // 402 so the mobile client can show its "upgrade" state for the whole page.
  const resolved = await resolveFeatureContext('insights.read', 'plus', { write: false })
  if (!resolved.ok) return resolved.response
  const { restaurantId, tier } = resolved.ctx

  const sp = req.nextUrl.searchParams
  const range = parseRange({
    range: sp.get('range') ?? undefined,
    from: sp.get('from') ?? undefined,
    to: sp.get('to') ?? undefined,
  })

  const data = await loadInsightData(restaurantId, range)
  const occupancy = computeOccupancy(data.bookings, range.from, range.to)
  const patterns = computePatterns(data.bookings, data.previousBookings)
  const orders = computeOrders(data.orders)
  const dishes = computeTopDishes(data.orders)

  const isPremium = tierAtLeast(tier, 'premium')

  // Non-Premium: shape mirrors the website's "Revenue locked" branch — the
  // revenue / breakdown / no-show-cost keys are intentionally absent, not
  // null. This keeps us from ever leaking Premium data to Plus tenants.
  if (!isPremium) {
    return NextResponse.json(
      {
        ok: true,
        isPremium,
        range,
        occupancy,
        patterns,
        orders,
        dishes,
      },
      { headers: NO_STORE },
    )
  }

  // Premium: locale here only drives the category label fallback (nl vs en).
  // The existing website page passes the request locale; mobile has none at
  // the HTTP boundary, so we default to 'nl' (the restaurant's primary
  // language on this backend) and preserve the exact website calculations.
  const dims = await loadRevenueDims(restaurantId, 'nl')
  const revenue = computeRevenue(data.orders, data.bookings, range.from, range.to)
  const tables = revenueByTable(data.orders, dims.tableLabel, dims.zoneOfTable)
  const perCategory = revenueByCategory(data.orders, dims.categoryOfItem, dims.categoryLabel)
  const noShowCost = computeNoShowCost(data.orders, data.bookings)

  return NextResponse.json(
    {
      ok: true,
      isPremium,
      range,
      occupancy,
      patterns,
      orders,
      dishes,
      revenue,
      revenueBreakdown: {
        perTable: tables.perTable,
        perZone: tables.perZone,
        perCategory,
      },
      noShowCost,
    },
    { headers: NO_STORE },
  )
}
