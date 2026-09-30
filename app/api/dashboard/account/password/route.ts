// POST /api/dashboard/account/password
// Body: { currentPassword: string, newPassword: string }
// Verifies the current password (server-side, against the session user's own
// email — never one from the body), then changes it with the caller's session.

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { dashboardAudit } from '@/lib/dashboard/audit/dashboardAudit'
import { resolveAccountContext, NO_STORE } from '@/lib/dashboard/account/resolveAccountContext'
import { PASSWORD_MAX, validateNewPassword } from '@/lib/dashboard/account/accountValidation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const resolved = await resolveAccountContext({ sensitive: true })
  if (!resolved.ok) return resolved.response
  const { supabase, user, restaurantId, staff } = resolved.ctx

  let body: { currentPassword?: unknown; newPassword?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, code: 'invalid_body' }, { status: 400, headers: NO_STORE })
  }

  const current = body.currentPassword
  if (typeof current !== 'string' || current.length === 0 || current.length > PASSWORD_MAX) {
    return NextResponse.json({ ok: false, code: 'wrong_password' }, { status: 400, headers: NO_STORE })
  }
  const next = validateNewPassword(body.newPassword)
  if (!next.ok) {
    return NextResponse.json({ ok: false, code: next.code }, { status: 400, headers: NO_STORE })
  }
  if (!user.email) {
    return NextResponse.json({ ok: false, code: 'no_email' }, { status: 400, headers: NO_STORE })
  }

  // Verify the current password on a throwaway client: no cookies, no stored
  // session, so the caller's real session is left exactly as it was.
  const verifier = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_PROD_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PROD_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  )
  const { error: verifyError } = await verifier.auth.signInWithPassword({
    email: user.email,
    password: current,
  })
  if (verifyError) {
    const code = verifyError.status === 429 ? 'rate_limited' : 'wrong_password'
    return NextResponse.json(
      { ok: false, code },
      { status: verifyError.status === 429 ? 429 : 400, headers: NO_STORE },
    )
  }

  if (current === next.value) {
    return NextResponse.json({ ok: false, code: 'same_password' }, { status: 400, headers: NO_STORE })
  }

  const { error } = await supabase.auth.updateUser({ password: next.value })
  if (error) {
    console.error('[account/password] updateUser failed', error.status, error.code)
    const code =
      error.code === 'same_password'
        ? 'same_password'
        : error.code === 'weak_password'
          ? 'weak_password'
          : 'password_change_failed'
    return NextResponse.json(
      { ok: false, code },
      { status: code === 'password_change_failed' ? 500 : 400, headers: NO_STORE },
    )
  }

  await dashboardAudit({
    restaurantId,
    staffId: staff.id,
    eventType: 'staff.password_changed',
    eventData: {},
  })

  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
