// app/api/consumer/privacy/data-deletion/verify/route.ts
//
// POST /api/consumer/privacy/data-deletion/verify
//
// Order: rate limit → parse → Zod → consume privacy magic link → blocking
//   checks (abort, no writes, if blocked) → atomic anonymisation via the
//   anonymise_guest RPC → render PDF + dispatch confirmation email to the
//   captured original address → audit

import { randomBytes } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { dataDeletionVerifyInputSchema } from '@/lib/consumer/schemas/privacySchema'
import { checkConsumerRateLimit, getCallerIp } from '@/lib/consumer/rateLimit'
import { consumePrivacyMagicLink } from '@/lib/consumer/magicLinks'
import { auditLog, PLATFORM_RESTAURANT_ID } from '@/lib/consumer/audit'
import { checkDeletionBlockers } from '@/lib/consumer/privacy/checkDeletionBlockers'
import { anonymiseGuest } from '@/lib/consumer/privacy/anonymiseGuest'
import { renderDataDeletionPdf } from '@/lib/consumer/privacy/renderDataDeletionPdf'
import { sendDataDeletionFileEmail } from '@/lib/consumer/notifications/dispatchDataDeletion'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function generateDeletionRef(): string {
  const buf = randomBytes(4)
  const n = buf.readUInt32BE(0)
  const s = n.toString(36).toUpperCase().padStart(7, '0').slice(0, 6)
  return `DEL-${s}`
}

export async function POST(req: NextRequest) {
  const ip = getCallerIp(req)
  const userAgent = req.headers.get('user-agent') ?? null

  // 1. Rate limit — shares the data_request key with export.
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
  const parsed = dataDeletionVerifyInputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  // 3. Consume the magic link (single-use, atomic).
  const consumed = await consumePrivacyMagicLink({
    token: parsed.data.token,
    purpose: 'data_deletion',
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

  // 4. Blocking checks — no writes happen if any block hits.
  const blockers = await checkDeletionBlockers(guestId)
  if (!blockers.ok) {
    await auditLog({
      restaurantId: PLATFORM_RESTAURANT_ID,
      eventType: 'privacy.data_deletion_blocked',
      eventData: { reason: blockers.reason, details: blockers.details },
      actorType: 'guest',
      actorId: guestId,
      ipAddress: ip,
      userAgent,
    }).catch(() => {})

    return NextResponse.json(
      { ok: false, error: 'blocked', reason: blockers.reason, details: blockers.details },
      { status: 409 }
    )
  }

  // 5. Atomic anonymisation.
  const result = await anonymiseGuest(guestId)
  if (!result.ok) {
    // The RPC re-checks blockers internally as a race safety net — if it
    // reports blocked here (rare), surface a generic blocked response rather
    // than the specific pre-check message, since state changed underneath us.
    if (result.reason !== 'failed' && result.reason !== 'guest_not_found') {
      await auditLog({
        restaurantId: PLATFORM_RESTAURANT_ID,
        eventType: 'privacy.data_deletion_blocked',
        eventData: { reason: result.reason, race: true },
        actorType: 'guest',
        actorId: guestId,
        ipAddress: ip,
        userAgent,
      }).catch(() => {})
      return NextResponse.json(
        { ok: false, error: 'blocked', reason: result.reason },
        { status: 409 }
      )
    }

    await auditLog({
      restaurantId: PLATFORM_RESTAURANT_ID,
      eventType: 'privacy.data_deletion_failed',
      eventData: { reason: result.reason },
      actorType: 'guest',
      actorId: guestId,
      ipAddress: ip,
      userAgent,
    }).catch(() => {})

    return NextResponse.json({ ok: false, error: 'failed' }, { status: 500 })
  }

  // 6. Render the confirmation PDF and email it to the captured original
  //    address — never the now-anonymised placeholder.
  const requestReference = generateDeletionRef()
  const generatedAtIso = new Date().toISOString()
  const pdfBuffer = await renderDataDeletionPdf(requestReference, generatedAtIso, locale)

  const dispatch = await sendDataDeletionFileEmail({
    locale,
    originalEmail: result.originalEmail,
    requestReference,
    pdfBuffer,
  })

  // 7. Audit.
  await auditLog({
    restaurantId: PLATFORM_RESTAURANT_ID,
    eventType: 'privacy.data_deletion_completed',
    eventData: { requestReference, locale, emailOk: dispatch.ok },
    actorType: 'guest',
    actorId: guestId,
    ipAddress: ip,
    userAgent,
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
