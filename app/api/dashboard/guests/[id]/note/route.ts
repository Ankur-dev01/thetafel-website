// POST /api/dashboard/guests/{id}/note   Body: { note: string }   (guests.note.edit — owner/manager; Plus+)
// Upserts guest_notes by (restaurant_id, guest_id). Empty note clears it. Max 2000 chars.
// Audit carries no note text.

import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'
import { resolveFeatureContext, NO_STORE } from '@/lib/dashboard/guests/guard'
import { guestBelongsToRestaurant } from '@/lib/dashboard/guests/guests'
import { dashboardAudit } from '@/lib/dashboard/audit/dashboardAudit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const GUEST_NOTE_MAX = 2000

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const resolved = await resolveFeatureContext('guests.note.edit', 'plus', { write: true })
  if (!resolved.ok) return resolved.response
  const { restaurantId, staff } = resolved.ctx

  let body: { note?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, code: 'invalid_body' }, { status: 400, headers: NO_STORE })
  }
  if (typeof body.note !== 'string') {
    return NextResponse.json({ ok: false, code: 'invalid_body' }, { status: 400, headers: NO_STORE })
  }
  const note = body.note.trim()
  if (note.length > GUEST_NOTE_MAX) {
    return NextResponse.json({ ok: false, code: 'note_too_long' }, { status: 400, headers: NO_STORE })
  }
  if (!UUID.test(id) || !(await guestBelongsToRestaurant(restaurantId, id))) {
    return NextResponse.json({ ok: false, code: 'not_found' }, { status: 404, headers: NO_STORE })
  }

  const admin = await createSupabaseServerClientAdmin()
  const now = new Date().toISOString()
  const { error } = await admin.from('guest_notes').upsert(
    { restaurant_id: restaurantId, guest_id: id, note: note || null, updated_by: staff.id, updated_at: now },
    { onConflict: 'restaurant_id,guest_id' },
  )
  if (error) {
    console.error('[guests/note] upsert failed', error.message)
    return NextResponse.json({ ok: false, code: 'db_error' }, { status: 500, headers: NO_STORE })
  }

  await dashboardAudit({
    restaurantId,
    staffId: staff.id,
    eventType: 'guest.note_updated',
    eventData: { guestId: id, cleared: note.length === 0, length: note.length },
  })
  return NextResponse.json({ ok: true, note: note || null, updatedAt: now }, { headers: NO_STORE })
}
