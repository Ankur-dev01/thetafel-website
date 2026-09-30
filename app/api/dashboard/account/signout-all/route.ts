// POST /api/dashboard/account/signout-all
// Revokes every session of the caller (all devices), including this one.

import { NextResponse } from 'next/server'
import { dashboardAudit } from '@/lib/dashboard/audit/dashboardAudit'
import { resolveAccountContext, NO_STORE } from '@/lib/dashboard/account/resolveAccountContext'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  const resolved = await resolveAccountContext()
  if (!resolved.ok) return resolved.response
  const { supabase, restaurantId, staff } = resolved.ctx

  // Audit first: once the session is gone there's no actor left to attribute.
  await dashboardAudit({
    restaurantId,
    staffId: staff.id,
    eventType: 'staff.signed_out_everywhere',
    eventData: {},
  })

  const { error } = await supabase.auth.signOut({ scope: 'global' })
  if (error) {
    console.error('[account/signout-all] signOut failed', error.message)
    return NextResponse.json({ ok: false, code: 'signout_failed' }, { status: 500, headers: NO_STORE })
  }

  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
