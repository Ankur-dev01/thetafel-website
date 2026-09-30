// POST /api/dashboard/account/email   Body: { email: string }
// Starts a Supabase auth email change with the caller's OWN session — Supabase
// sends the confirmation mails (to both the old and new address). Does not
// touch restaurants.contact_email.

import { NextResponse, type NextRequest } from 'next/server'
import { dashboardAudit } from '@/lib/dashboard/audit/dashboardAudit'
import { resolveAccountContext, NO_STORE } from '@/lib/dashboard/account/resolveAccountContext'
import { validateAccountEmail } from '@/lib/dashboard/account/accountValidation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const resolved = await resolveAccountContext({ sensitive: true })
  if (!resolved.ok) return resolved.response
  const { supabase, user, restaurantId, staff } = resolved.ctx

  let body: { email?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, code: 'invalid_body' }, { status: 400, headers: NO_STORE })
  }

  const email = validateAccountEmail(body.email)
  if (!email.ok) {
    return NextResponse.json({ ok: false, code: email.code }, { status: 400, headers: NO_STORE })
  }
  if (email.value === (user.email ?? '').toLowerCase()) {
    return NextResponse.json({ ok: false, code: 'same_email' }, { status: 400, headers: NO_STORE })
  }

  const { error } = await supabase.auth.updateUser({ email: email.value })
  if (error) {
    // "already registered" is deliberately reported like any other failure —
    // don't let this form be used to probe which addresses have accounts.
    console.error('[account/email] updateUser failed', error.status, error.code)
    const status = error.status === 429 ? 429 : 400
    return NextResponse.json(
      { ok: false, code: error.status === 429 ? 'rate_limited' : 'email_change_failed' },
      { status, headers: NO_STORE },
    )
  }

  await dashboardAudit({
    restaurantId,
    staffId: staff.id,
    eventType: 'staff.email_change_requested',
    eventData: {},
  })

  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
