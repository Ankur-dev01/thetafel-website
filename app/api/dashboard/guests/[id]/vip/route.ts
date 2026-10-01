// POST /api/dashboard/guests/{id}/vip   Body: { vip: boolean }   (guests.vip.toggle — owner/manager; Premium)
// Per-restaurant VIP flag on guest_notes.is_vip. Never guests.loyalty_tier (global table).

import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'
import { resolveFeatureContext, NO_STORE } from '@/lib/dashboard/guests/guard'
import { guestBelongsToRestaurant } from '@/lib/dashboard/guests/guests'
import { dashboardAudit } from '@/lib/dashboard/audit/dashboardAudit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const resolved = await resolveFeatureContext('guests.vip.toggle', 'premium', { write: true })
  if (!resolved.ok) return resolved.response
  const { restaurantId, staff } = resolved.ctx

  let body: { vip?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, code: 'invalid_body' }, { status: 400, headers: NO_STORE })
  }
  if (typeof body.vip !== 'boolean') {
    return NextResponse.json({ ok: false, code: 'invalid_body' }, { status: 400, headers: NO_STORE })
  }
  if (!UUID.test(id) || !(await guestBelongsToRestaurant(restaurantId, id))) {
    return NextResponse.json({ ok: false, code: 'not_found' }, { status: 404, headers: NO_STORE })
  }

  const admin = await createSupabaseServerClientAdmin()
  // Upsert only touches the columns given, so an existing note is kept.
  const { error } = await admin.from('guest_notes').upsert(
    { restaurant_id: restaurantId, guest_id: id, is_vip: body.vip, updated_by: staff.id, updated_at: new Date().toISOString() },
    { onConflict: 'restaurant_id,guest_id' },
  )
  if (error) {
    console.error('[guests/vip] upsert failed', error.message)
    return NextResponse.json({ ok: false, code: 'db_error' }, { status: 500, headers: NO_STORE })
  }

  await dashboardAudit({
    restaurantId,
    staffId: staff.id,
    eventType: 'guest.vip_toggled',
    eventData: { guestId: id, vip: body.vip },
  })
  return NextResponse.json({ ok: true, vip: body.vip }, { headers: NO_STORE })
}
