// app/api/cron/booking-reminders/route.ts
//
// POST /api/cron/booking-reminders
//
// D5.6d: triggered by a pg_cron job every 10 minutes (scheduled outside
// this repo, against this endpoint — see migration 028_cron_infrastructure.sql
// and lib/consumer/notifications/bookingReminders.ts's header comment).
//
// Auth: Authorization: Bearer <token>, verified via the service_role-only
// `verify_cron_secret` RPC against the Vault-stored secret. This repo never
// sees the secret value itself — no CRON_SECRET env var, no vercel.json cron.
//
// `/api/*` is excluded from proxy.ts's matcher entirely, so nothing rewrites
// or locale-gates this route.

import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'
import { runBookingReminders } from '@/lib/consumer/notifications/bookingReminders'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET() {
  return NextResponse.json({ error: 'method_not_allowed' }, { status: 405 })
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')

  // Accept the header with or without a "Bearer " prefix — the caller is a
  // pg_net job configured outside this repo, and a strict `startsWith('Bearer ')`
  // check would silently reject (zero log lines) a header sent as the bare
  // secret. Never log the header value itself, on any path below.
  const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : null

  if (!token) {
    console.error('[cron/booking-reminders] missing or empty authorization header')
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = await createSupabaseServerClientAdmin()

  const { data: verified, error: verifyErr } = await admin.rpc('verify_cron_secret', {
    p_token: token,
  })

  if (verifyErr) {
    console.error('[cron/booking-reminders] verify_cron_secret rpc error', {
      code: verifyErr.code,
      message: verifyErr.message,
    })
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (verified !== true) {
    console.error('[cron/booking-reminders] verify_cron_secret returned non-true', {
      typeofVerified: typeof verified,
    })
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const counts = await runBookingReminders()

  // auditLog requires a non-null restaurantId (lib/consumer/audit.ts) and a
  // single cron run spans many restaurants, so there's no correct value to
  // pass for a run-level summary row — per-booking email.sent/send_failed
  // audit rows (written by sendConsumerEmail, correctly restaurant-scoped)
  // already cover this run's activity. Only log when something happened.
  if (counts.sent24h > 0 || counts.sent2h > 0 || counts.failed > 0) {
    console.log('[cron/booking-reminders]', counts)
  }

  return NextResponse.json({ ok: true, ...counts })
}
