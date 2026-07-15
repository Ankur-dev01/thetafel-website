// app/api/consumer/privacy/data-request/route.ts
//
// POST /api/consumer/privacy/data-request
//
// Order: rate limit → parse → Zod → Turnstile → sanitize email → guest
//   lookup → (if found) create magic link + dispatch link email → audit →
//   neutral response regardless of whether the email was found

import { NextResponse, type NextRequest } from 'next/server'
import { dataRequestInputSchema } from '@/lib/consumer/schemas/privacySchema'
import { normalizeEmail, isValidEmail } from '@/lib/consumer/sanitize'
import { checkConsumerRateLimit, getCallerIp, redactIp } from '@/lib/consumer/rateLimit'
import { verifyTurnstileToken } from '@/lib/consumer/turnstile'
import { createMagicLink } from '@/lib/consumer/magicLinks'
import { auditLog, PLATFORM_RESTAURANT_ID } from '@/lib/consumer/audit'
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'
import { sendDataExportLinkEmail } from '@/lib/consumer/notifications/dispatchDataExport'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NEUTRAL_RESPONSE = { ok: true as const }

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
  const parsed = dataRequestInputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'invalid_body', issues: parsed.error.flatten() },
      { status: 400 }
    )
  }
  const input = parsed.data

  // 3. Turnstile.
  const tv = await verifyTurnstileToken(input.turnstileToken, ip)
  if (!tv.ok) {
    return NextResponse.json({ ok: false, error: 'turnstile_failed' }, { status: 403 })
  }

  // 4. Sanitize + validate email.
  const email = normalizeEmail(input.email)
  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  // 5. Guest lookup — neutral response either way, so branch quietly.
  let guestFound = false
  try {
    const admin = await createSupabaseServerClientAdmin()
    const { data: guest } = await admin
      .from('guests')
      .select('id, full_name, email')
      .eq('email_lower', email)
      .is('anonymised_at', null)
      .maybeSingle()

    if (guest) {
      guestFound = true

      const created = await createMagicLink({
        purpose: 'data_export',
        guestId: guest.id,
        locale: input.locale,
        restaurantId: PLATFORM_RESTAURANT_ID,
        ipAddress: ip,
        userAgent,
      })

      if (created.ok) {
        const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://thetafel.nl'
        const localePrefix = input.locale === 'en' ? '/en' : ''
        const verifyUrl = `${base}${localePrefix}/privacy/data-request/verify?token=${encodeURIComponent(created.token)}`

        void sendDataExportLinkEmail({
          locale: input.locale,
          guestFullName: guest.full_name,
          guestEmail: guest.email,
          verifyUrl,
        }).catch((err) => {
          console.error('[privacy/data-request] link email dispatch failed', err)
        })
      } else {
        console.error('[privacy/data-request] createMagicLink failed', created.reason)
      }
    }
  } catch (err) {
    console.error('[privacy/data-request] unexpected error', err)
  }

  // 6. Always audit, always respond the same way.
  await auditLog({
    restaurantId: PLATFORM_RESTAURANT_ID,
    eventType: 'privacy.data_export_requested',
    eventData: { guestFound, ip_masked: redactIp(ip), locale: input.locale },
    actorType: 'guest',
    ipAddress: ip,
    userAgent,
  }).catch(() => {})

  return NextResponse.json(NEUTRAL_RESPONSE)
}
