// POST /api/dashboard/staff/invite/revoke   Body: { inviteId: string }

import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'
import { resolveMenuMutationContext } from '@/lib/dashboard/menu/resolveMenuMutationContext'
import { dashboardAudit } from '@/lib/dashboard/audit/dashboardAudit'
import { canRevokeInvite } from '@/lib/dashboard/staff/rolePolicy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' } as const
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: NextRequest) {
  const resolved = await resolveMenuMutationContext('settings.staff.invite')
  if (!resolved.ok) return resolved.response
  const { restaurant, staff } = resolved.ctx

  let body: { inviteId?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, code: 'invalid_body' }, { status: 400, headers: NO_STORE })
  }
  if (typeof body.inviteId !== 'string' || !UUID.test(body.inviteId)) {
    return NextResponse.json({ ok: false, code: 'invalid_body' }, { status: 400, headers: NO_STORE })
  }

  const admin = await createSupabaseServerClientAdmin()
  const { data: invite } = await admin
    .from('staff_invites')
    .select('id, role, email_lower, accepted_at, revoked_at')
    .eq('id', body.inviteId)
    .eq('restaurant_id', restaurant.id)
    .maybeSingle<{ id: string; role: 'manager' | 'service' | 'kitchen'; email_lower: string; accepted_at: string | null; revoked_at: string | null }>()
  if (!invite) return NextResponse.json({ ok: false, code: 'not_found' }, { status: 404, headers: NO_STORE })
  if (!canRevokeInvite(staff.role, invite.role)) {
    return NextResponse.json({ ok: false, code: 'role_not_allowed' }, { status: 403, headers: NO_STORE })
  }
  if (invite.accepted_at || invite.revoked_at) {
    return NextResponse.json({ ok: false, code: 'not_pending' }, { status: 409, headers: NO_STORE })
  }

  const { error } = await admin
    .from('staff_invites')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', invite.id)
    .eq('restaurant_id', restaurant.id)
  if (error) return NextResponse.json({ ok: false, code: 'db_error' }, { status: 500, headers: NO_STORE })

  await dashboardAudit({
    restaurantId: restaurant.id,
    staffId: staff.id,
    eventType: 'staff.invite_revoked',
    eventData: { email: invite.email_lower, role: invite.role },
  })
  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
