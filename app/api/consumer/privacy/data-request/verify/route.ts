// app/api/consumer/privacy/data-request/verify/route.ts
//
// POST /api/consumer/privacy/data-request/verify
//
// Order: rate limit → parse → Zod → consume privacy magic link → build
//   export → dispatch confirmation email with JSON attachment → audit

import { NextResponse, type NextRequest } from 'next/server'
import { dataRequestVerifyInputSchema } from '@/lib/consumer/schemas/privacySchema'
import { checkConsumerRateLimit, getCallerIp } from '@/lib/consumer/rateLimit'
import { consumePrivacyMagicLink } from '@/lib/consumer/magicLinks'
import { auditLog, PLATFORM_RESTAURANT_ID } from '@/lib/consumer/audit'
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'
import { buildDataExport } from '@/lib/consumer/privacy/buildDataExport'
import { renderDataExportPdf } from '@/lib/consumer/privacy/renderDataExportPdf'
import { sendDataExportFileEmail } from '@/lib/consumer/notifications/dispatchDataExport'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const ip = getCallerIp(req)
  const userAgent = req.headers.get('user-agent') ?? null

  // 1. Rate limit.
  const rl = await checkConsumerRateLimit('data_request', ip)
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds ?? 3600) } }
    )
  }

  // 2. Parse + Zod.
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }
  const parsed = dataRequestVerifyInputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  // 3. Consume the magic link (single-use, atomic).
  const consumed = await consumePrivacyMagicLink({
    token: parsed.data.token,
    purpose: 'data_export',
    ipAddress: ip,
    userAgent,
  })
  if (!consumed.ok) {
    return NextResponse.json(
      { ok: false, error: 'invalid_or_expired_token' },
      { status: 403 }
    )
  }
  const { guestId, locale } = consumed.payload

  const admin = await createSupabaseServerClientAdmin()
  const { data: guest } = await admin
    .from('guests')
    .select('id, full_name, email')
    .eq('id', guestId)
    .maybeSingle()

  if (!guest) {
    // Guest row vanished between link creation and consumption (e.g.
    // anonymised in the interim). Nothing sensible to email.
    return NextResponse.json({ ok: false, error: 'guest_not_found' }, { status: 404 })
  }

  // 4. Build the export (JSON payload + PDF companion) and email both.
  const payload = await buildDataExport(guestId, locale)
  const pdfBuffer = await renderDataExportPdf(payload, locale)

  const dispatch = await sendDataExportFileEmail({
    locale,
    guestFullName: guest.full_name,
    guestEmail: guest.email,
    payload,
    pdfBuffer,
  })

  // 5. Audit.
  await auditLog({
    restaurantId: PLATFORM_RESTAURANT_ID,
    eventType: 'privacy.data_export_completed',
    eventData: {
      requestReference: payload.request_reference,
      locale,
      emailOk: dispatch.ok,
    },
    actorType: 'guest',
    actorId: guestId,
    ipAddress: ip,
    userAgent,
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
