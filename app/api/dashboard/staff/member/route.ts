// POST /api/dashboard/staff/member
// Body: { memberId: string, action: 'role' | 'deactivate' | 'reactivate', role?: string }
// Soft deactivation only (deactivated_at) - rows are never deleted so audit trails keep pointing at people.
// Target-role limits come from staff/rolePolicy.ts (managers manage service/kitchen only;
// nobody touches the owner or themselves).

import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'
import { resolveMenuMutationContext } from '@/lib/dashboard/menu/resolveMenuMutationContext'
import { dashboardAudit } from '@/lib/dashboard/audit/dashboardAudit'
import { canChangeRole, canToggleActive } from '@/lib/dashboard/staff/rolePolicy'
import type { StaffRole } from '@/lib/dashboard/nav'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' } as const
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ROLES = ['owner', 'manager', 'service', 'kitchen']

export async function POST(req: NextRequest) {
  let body: { memberId?: unknown; action?: unknown; role?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, code: 'invalid_body' }, { status: 400, headers: NO_STORE })
  }
  const action = body.action
  if (action !== 'role' && action !== 'deactivate' && action !== 'reactivate') {
    return NextResponse.json({ ok: false, code: 'invalid_action' }, { status: 400, headers: NO_STORE })
  }
  if (typeof body.memberId !== 'string' || !UUID.test(body.memberId)) {
    return NextResponse.json({ ok: false, code: 'invalid_body' }, { status: 400, headers: NO_STORE })
  }

  const resolved = await resolveMenuMutationContext(
    action === 'role' ? 'settings.staff.role_change' : 'settings.staff.deactivate',
  )
  if (!resolved.ok) return resolved.response
  const { restaurant, staff } = resolved.ctx

  const admin = await createSupabaseServerClientAdmin()
  const { data: target } = await admin
    .from('restaurant_staff')
    .select('id, role, deactivated_at')
    .eq('id', body.memberId)
    .eq('restaurant_id', restaurant.id)
    .maybeSingle<{ id: string; role: StaffRole; deactivated_at: string | null }>()
  if (!target) return NextResponse.json({ ok: false, code: 'not_found' }, { status: 404, headers: NO_STORE })

  const t = { role: target.role, isSelf: target.id === staff.id }

  if (action === 'role') {
    const newRole = body.role
    if (typeof newRole !== 'string' || !ROLES.includes(newRole)) {
      return NextResponse.json({ ok: false, code: 'invalid_role' }, { status: 400, headers: NO_STORE })
    }
    if (!canChangeRole(staff.role, t, newRole as StaffRole)) {
      return NextResponse.json({ ok: false, code: 'role_not_allowed' }, { status: 403, headers: NO_STORE })
    }
    const { error } = await admin
      .from('restaurant_staff')
      .update({ role: newRole })
      .eq('id', target.id)
      .eq('restaurant_id', restaurant.id)
    if (error) return NextResponse.json({ ok: false, code: 'db_error' }, { status: 500, headers: NO_STORE })
    await dashboardAudit({
      restaurantId: restaurant.id,
      staffId: staff.id,
      eventType: 'staff.role_changed',
      eventData: { memberId: target.id, from: target.role, to: newRole },
    })
    return NextResponse.json({ ok: true }, { headers: NO_STORE })
  }

  if (!canToggleActive(staff.role, t)) {
    return NextResponse.json({ ok: false, code: 'role_not_allowed' }, { status: 403, headers: NO_STORE })
  }
  const deactivate = action === 'deactivate'
  if (deactivate === (target.deactivated_at !== null)) {
    return NextResponse.json({ ok: false, code: deactivate ? 'already_deactivated' : 'already_active' }, { status: 409, headers: NO_STORE })
  }
  const { error } = await admin
    .from('restaurant_staff')
    .update({ deactivated_at: deactivate ? new Date().toISOString() : null })
    .eq('id', target.id)
    .eq('restaurant_id', restaurant.id)
  if (error) return NextResponse.json({ ok: false, code: 'db_error' }, { status: 500, headers: NO_STORE })
  await dashboardAudit({
    restaurantId: restaurant.id,
    staffId: staff.id,
    eventType: deactivate ? 'staff.deactivated' : 'staff.reactivated',
    eventData: { memberId: target.id, role: target.role },
  })
  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
