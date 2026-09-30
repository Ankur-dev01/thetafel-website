// POST /api/dashboard/staff/invite   Body: { email: string, role: 'manager'|'service'|'kitchen' }
// Owner or manager. Owners invite manager/service/kitchen; managers service/kitchen only;
// nobody invites an owner (also a DB CHECK). Re-inviting an email replaces its pending invite.

import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'
import { resolveMenuMutationContext } from '@/lib/dashboard/menu/resolveMenuMutationContext'
import { dashboardAudit } from '@/lib/dashboard/audit/dashboardAudit'
import { canInviteRole, type InvitableRole } from '@/lib/dashboard/staff/rolePolicy'
import { createOrRefreshInvite, inviteStatus, normaliseEmail } from '@/lib/dashboard/staff/invites'
import { sendConsumerEmail } from '@/lib/consumer/email/send'
import { renderStaffInvite } from '@/lib/notifications/restaurant/templates/staffInvite'
import { publicOrigin } from '@/lib/url/publicOrigin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' } as const
const STATUS = { rate_limited: 429, already_member: 409, db_error: 500 } as const

export async function POST(req: NextRequest) {
  const resolved = await resolveMenuMutationContext('settings.staff.invite')
  if (!resolved.ok) return resolved.response
  const { restaurant, staff } = resolved.ctx

  let body: { email?: unknown; role?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, code: 'invalid_body' }, { status: 400, headers: NO_STORE })
  }
  const email = normaliseEmail(body.email)
  if (!email) return NextResponse.json({ ok: false, code: 'invalid_email' }, { status: 400, headers: NO_STORE })

  const role = body.role as InvitableRole
  if (!['manager', 'service', 'kitchen'].includes(role as string)) {
    return NextResponse.json({ ok: false, code: 'invalid_role' }, { status: 400, headers: NO_STORE })
  }
  if (!canInviteRole(staff.role, role)) {
    return NextResponse.json({ ok: false, code: 'role_not_allowed' }, { status: 403, headers: NO_STORE })
  }

  const admin = await createSupabaseServerClientAdmin()
  const { data: prior } = await admin
    .from('staff_invites')
    .select('expires_at, accepted_at, revoked_at')
    .eq('restaurant_id', restaurant.id)
    .eq('email_lower', email)
    .maybeSingle()

  const created = await createOrRefreshInvite({ admin, restaurantId: restaurant.id, email, role, invitedByStaffId: staff.id })
  if (!created.ok) {
    return NextResponse.json({ ok: false, code: created.code }, { status: STATUS[created.code], headers: NO_STORE })
  }

  const { data: r } = await admin
    .from('restaurants')
    .select('display_name, legal_name, slug')
    .eq('id', restaurant.id)
    .maybeSingle<{ display_name: string | null; legal_name: string | null; slug: string }>()
  const restaurantName = r?.display_name ?? r?.legal_name ?? r?.slug ?? 'The Tafel'

  const locale: 'nl' | 'en' = staff.language === 'en' ? 'en' : 'nl'
  const acceptUrl = `${publicOrigin()}${locale === 'en' ? '/en' : ''}/staff/accept?token=${encodeURIComponent(created.token)}`
  const rendered = renderStaffInvite({ locale, restaurantName, inviterName: staff.display_name, role, acceptUrl })
  const send = await sendConsumerEmail({
    to: email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    templateKey: 'staff.invite',
    restaurantId: restaurant.id,
    skipAdminBcc: true,
  })

  if (prior && inviteStatus(prior) === 'valid') {
    await dashboardAudit({
      restaurantId: restaurant.id,
      staffId: staff.id,
      eventType: 'staff.invite_revoked',
      eventData: { reason: 'superseded_by_reinvite', email },
    })
  }
  await dashboardAudit({
    restaurantId: restaurant.id,
    staffId: staff.id,
    eventType: 'staff.invited',
    eventData: { email, role, replaced: created.replaced, emailSent: send.ok },
  })

  return NextResponse.json({ ok: true, emailSent: send.ok }, { headers: NO_STORE })
}
