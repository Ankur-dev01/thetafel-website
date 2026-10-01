// GET /api/dashboard/guests/{id}   (guests.read; Plus+)
// 404 unless the guest has a booking or order at THIS restaurant and isn't anonymised.

import { NextResponse, type NextRequest } from 'next/server'
import { resolveFeatureContext, NO_STORE } from '@/lib/dashboard/guests/guard'
import { getGuestDetail } from '@/lib/dashboard/guests/guests'
import { tierAtLeast } from '@/lib/dashboard/tier'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const resolved = await resolveFeatureContext('guests.read', 'plus')
  if (!resolved.ok) return resolved.response
  if (!UUID.test(id)) return NextResponse.json({ ok: false, code: 'not_found' }, { status: 404, headers: NO_STORE })

  const detail = await getGuestDetail(resolved.ctx.restaurantId, id)
  if (!detail) return NextResponse.json({ ok: false, code: 'not_found' }, { status: 404, headers: NO_STORE })

  const premium = tierAtLeast(resolved.ctx.tier, 'premium')
  return NextResponse.json({ ok: true, guest: { ...detail, vip: premium ? detail.vip : false } }, { headers: NO_STORE })
}
