// GET /api/dashboard/guests?q=&page=   (guests.read — owner/manager/service; Plus+)
// This restaurant's guests only, anonymised excluded, most recent visit first.

import { NextResponse, type NextRequest } from 'next/server'
import { resolveFeatureContext, NO_STORE } from '@/lib/dashboard/guests/guard'
import { listGuests } from '@/lib/dashboard/guests/guests'
import { tierAtLeast } from '@/lib/dashboard/tier'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const resolved = await resolveFeatureContext('guests.read', 'plus')
  if (!resolved.ok) return resolved.response
  const { restaurantId, tier } = resolved.ctx

  const q = (req.nextUrl.searchParams.get('q') ?? '').slice(0, 80)
  const page = Number.parseInt(req.nextUrl.searchParams.get('page') ?? '1', 10) || 1

  const result = await listGuests(restaurantId, { search: q, page })
  const premium = tierAtLeast(tier, 'premium')
  return NextResponse.json(
    { ok: true, ...result, rows: result.rows.map((r) => ({ ...r, vip: premium ? r.vip : false })) },
    { headers: NO_STORE },
  )
}
