// app/api/cron/billing-lifecycle/route.ts
//
// POST /api/cron/billing-lifecycle
//
// D6.5: daily subscription lifecycle job (grace-period emails, day-14
// suspension, cancelled-subscription period end). Scheduled via pg_cron OUTSIDE
// this repo, like /api/cron/booking-reminders — call it on
// https://www.thetafel.nl/api/cron/billing-lifecycle. NOT the apex: the apex
// 307-redirects to www and the redirect drops the Authorization header.
//
// Auth: Authorization: Bearer <token> verified through the service_role-only
// `verify_cron_secret` RPC against the Vault secret. Every rejection is logged
// (never the header value).

import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'
import { runBillingLifecycle } from '@/lib/billing/runBillingLifecycle'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET() {
  return NextResponse.json({ error: 'method_not_allowed' }, { status: 405 })
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : null

  if (!token) {
    console.error('[cron/billing-lifecycle] missing or empty authorization header')
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = await createSupabaseServerClientAdmin()
  const { data: verified, error: verifyErr } = await admin.rpc('verify_cron_secret', { p_token: token })

  if (verifyErr) {
    console.error('[cron/billing-lifecycle] verify_cron_secret rpc error', {
      code: verifyErr.code,
      message: verifyErr.message,
    })
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (verified !== true) {
    console.error('[cron/billing-lifecycle] verify_cron_secret returned non-true', {
      typeofVerified: typeof verified,
    })
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const counts = await runBillingLifecycle(new Date())
  if (counts.graceEmails > 0 || counts.suspended > 0 || counts.ended > 0 || counts.errors > 0) {
    console.log('[cron/billing-lifecycle]', counts)
  }

  return NextResponse.json({
    ok: true,
    graceEmails: counts.graceEmails,
    suspended: counts.suspended,
    ended: counts.ended,
    errors: counts.errors,
  })
}
