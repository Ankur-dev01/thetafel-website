// POST /api/staff/accept   (public - reached from the invite email)
// Body: { token: string, name: string, password?: string, locale?: 'nl'|'en' }
//
//  - No auth user for the invited email: creates one (password required, min 8).
//    The invite email itself proves ownership of the address, so email_confirm is true.
//  - An auth user already exists: the caller must be logged in AS that user.
//  - One restaurant per login in v1: refused if the user is already active staff
//    (or owner) anywhere.
//
// The invite is claimed atomically FIRST (accepted_at IS NULL -> now), so a token
// works exactly once even under concurrent requests; the claim is released if a
// later step fails.

import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient, createSupabaseServerClientAdmin } from '@/lib/supabase/server'
import { dashboardAudit } from '@/lib/dashboard/audit/dashboardAudit'
import { findInviteByToken, findUserIdByEmail, inviteStatus } from '@/lib/dashboard/staff/invites'
import { validateDisplayName, validateNewPassword } from '@/lib/dashboard/account/accountValidation'
import { staffAcceptRateLimit } from '@/lib/dashboard/rateLimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' } as const
const fail = (code: string, status: number, extra: Record<string, string> = {}) =>
  NextResponse.json({ ok: false, code }, { status, headers: { ...NO_STORE, ...extra } })

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? '127.0.0.1'
  const rl = await staffAcceptRateLimit(ip)
  if (!rl.ok) return fail('rate_limited', 429, { 'Retry-After': String(rl.retryAfter ?? 60) })

  let body: { token?: unknown; name?: unknown; password?: unknown; locale?: unknown }
  try {
    body = await req.json()
  } catch {
    return fail('invalid_body', 400)
  }
  const token = typeof body.token === 'string' ? body.token : ''
  const locale: 'nl' | 'en' = body.locale === 'en' ? 'en' : 'nl'
  const name = validateDisplayName(body.name)
  if (!name.ok) return fail('invalid_name', 400)

  const admin = await createSupabaseServerClientAdmin()
  const invite = await findInviteByToken(admin, token)
  if (!invite) return fail('invalid_token', 404)
  const status = inviteStatus(invite)
  if (status !== 'valid') return fail(`invite_${status}`, 410)

  const email = invite.email_lower
  const existingUserId = await findUserIdByEmail(admin, email)

  // Who is accepting?
  let userId: string
  let createdUser = false
  if (existingUserId) {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail('login_required', 401)
    if (user.id !== existingUserId || (user.email ?? '').toLowerCase() !== email) return fail('wrong_account', 403)
    userId = user.id
  } else {
    const password = validateNewPassword(body.password)
    if (!password.ok) return fail(password.code, 400)
    userId = '' // set after creation below (after the claim)
  }

  // One restaurant per login (v1).
  if (existingUserId) {
    const [{ data: active }, { data: owned }] = await Promise.all([
      admin.from('restaurant_staff').select('restaurant_id').eq('user_id', userId).is('deactivated_at', null),
      admin.from('restaurants').select('id').eq('user_id', userId).is('deleted_at', null),
    ])
    const elsewhere = [...(active ?? []).map((r) => r.restaurant_id as string), ...(owned ?? []).map((r) => r.id as string)]
    if (elsewhere.includes(invite.restaurant_id)) return fail('already_member', 409)
    if (elsewhere.length > 0) return fail('already_staff_elsewhere', 409)
  }

  // Claim the invite (single use).
  const { data: claimed } = await admin
    .from('staff_invites')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invite.id)
    .is('accepted_at', null)
    .is('revoked_at', null)
    .select('id')
    .maybeSingle()
  if (!claimed) return fail('invite_accepted', 410)
  const release = async () => {
    await admin.from('staff_invites').update({ accepted_at: null }).eq('id', invite.id)
  }

  try {
    if (!existingUserId) {
      const password = validateNewPassword(body.password)
      if (!password.ok) throw new Error('invalid_password')
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password: password.value,
        email_confirm: true,
      })
      if (createError || !created.user) {
        await release()
        const weak = createError?.code === 'weak_password'
        return fail(weak ? 'weak_password' : 'account_create_failed', weak ? 400 : 500)
      }
      userId = created.user.id
      createdUser = true
    }

    // Profile locale (row is created by the auth trigger; tolerate a missing one).
    await admin.from('profiles').update({ locale }).eq('id', userId)

    const { data: priorRow } = await admin
      .from('restaurant_staff')
      .select('id')
      .eq('restaurant_id', invite.restaurant_id)
      .eq('user_id', userId)
      .maybeSingle<{ id: string }>()

    let staffId: string
    if (priorRow) {
      // A previously deactivated member being invited back.
      const { error } = await admin
        .from('restaurant_staff')
        .update({ role: invite.role, display_name: name.value, language: locale, invited_by: invite.invited_by, deactivated_at: null })
        .eq('id', priorRow.id)
        .eq('restaurant_id', invite.restaurant_id)
      if (error) throw new Error(`staff_update_failed:${error.message}`)
      staffId = priorRow.id
    } else {
      const { data: inserted, error } = await admin
        .from('restaurant_staff')
        .insert({
          restaurant_id: invite.restaurant_id,
          user_id: userId,
          role: invite.role,
          display_name: name.value,
          language: locale,
          invited_by: invite.invited_by,
        })
        .select('id')
        .single<{ id: string }>()
      if (error || !inserted) throw new Error(`staff_insert_failed:${error?.message}`)
      staffId = inserted.id
    }

    await dashboardAudit({
      restaurantId: invite.restaurant_id,
      staffId,
      eventType: 'staff.invite_accepted',
      eventData: { role: invite.role, inviteId: invite.id, newAccount: createdUser },
    })

    return NextResponse.json(
      { ok: true, role: invite.role, email, createdAccount: createdUser, destination: invite.role === 'kitchen' ? '/dashboard/orders' : '/dashboard' },
      { headers: NO_STORE },
    )
  } catch (err) {
    console.error('[staff/accept] failed, rolling back', err instanceof Error ? err.message : err)
    if (createdUser && userId) await admin.auth.admin.deleteUser(userId).catch(() => {})
    await release()
    return fail('accept_failed', 500)
  }
}
