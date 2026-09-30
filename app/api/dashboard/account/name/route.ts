// POST /api/dashboard/account/name   Body: { displayName: string }
// Edits restaurant_staff.display_name for the caller's own staff row.

import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'
import { dashboardAudit } from '@/lib/dashboard/audit/dashboardAudit'
import { resolveAccountContext, NO_STORE } from '@/lib/dashboard/account/resolveAccountContext'
import { validateDisplayName } from '@/lib/dashboard/account/accountValidation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const resolved = await resolveAccountContext()
  if (!resolved.ok) return resolved.response
  const { user, restaurantId, staff } = resolved.ctx

  let body: { displayName?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, code: 'invalid_body' }, { status: 400, headers: NO_STORE })
  }

  const name = validateDisplayName(body.displayName)
  if (!name.ok) {
    return NextResponse.json({ ok: false, code: name.code }, { status: 400, headers: NO_STORE })
  }

  const admin = await createSupabaseServerClientAdmin()
  const { error } = await admin
    .from('restaurant_staff')
    .update({ display_name: name.value })
    .eq('restaurant_id', restaurantId)
    .eq('user_id', user.id)
  if (error) {
    console.error('[account/name] update failed', error.message)
    return NextResponse.json({ ok: false, code: 'db_error' }, { status: 500, headers: NO_STORE })
  }

  await dashboardAudit({
    restaurantId,
    staffId: staff.id,
    eventType: 'staff.profile_updated',
    eventData: { fields: ['display_name'] },
  })

  return NextResponse.json({ ok: true, displayName: name.value }, { headers: NO_STORE })
}
