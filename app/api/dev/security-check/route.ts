import { NextRequest, NextResponse } from 'next/server'
import {
  checkConsumerRateLimit,
  getCallerIp,
  rateLimitHeaders,
  redactIp,
} from '@/lib/consumer/rateLimit'
import { verifyTurnstileToken } from '@/lib/consumer/turnstile'
import { auditLog } from '@/lib/consumer/audit'
import {
  assertConsumerWriteAllowed,
  rejectionPayload,
  type ConsumerWriteAction,
} from '@/lib/consumer/guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' }

/**
 * Dev-only sanity checks for the security primitives.
 *
 * Hard-404 in production.
 *
 *   GET ?action=rate_limit_test
 *   GET ?action=rate_limit_real
 *   GET ?action=turnstile_test&token=XYZ
 *   GET ?action=audit_test&restaurantId=<uuid>
 *   GET ?action=doorman_test&restaurantId=<uuid>&doormanAction=booking.create
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse(null, { status: 404, headers: NO_STORE })
  }

  const url = new URL(request.url)
  const action = url.searchParams.get('action')
  const ip = getCallerIp(request)

  if (action === 'rate_limit_test') {
    const result = await checkConsumerRateLimit('booking_submit', ip)
    return NextResponse.json(
      {
        action: 'rate_limit_test',
        callerIp: redactIp(ip),
        result,
        note:
          'In NODE_ENV=development the helper bypasses Redis. Use action=rate_limit_real for an end-to-end Upstash check.',
      },
      { headers: { ...NO_STORE, ...rateLimitHeaders(result) } }
    )
  }

  if (action === 'rate_limit_real') {
    const { Ratelimit } = await import('@upstash/ratelimit')
    const { Redis } = await import('@upstash/redis')
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
    const limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, '1 m'),
      prefix: 'csm:devcheck',
      analytics: false,
    })
    const result = await limiter.limit(ip)
    return NextResponse.json(
      {
        action: 'rate_limit_real',
        callerIp: redactIp(ip),
        allowed: result.success,
        limit: result.limit,
        remaining: result.remaining,
        resetEpochMs: result.reset,
      },
      { headers: NO_STORE }
    )
  }

  if (action === 'turnstile_test') {
    const token = url.searchParams.get('token') ?? ''
    const result = await verifyTurnstileToken(token, ip)
    return NextResponse.json(
      {
        action: 'turnstile_test',
        callerIp: redactIp(ip),
        tokenPrefix: token ? token.slice(0, 8) : null,
        result,
        note:
          'With no TURNSTILE_SECRET_KEY set in dev, this always returns ok=true with reason=dev_bypass. Set the env var to actually call Cloudflare siteverify.',
      },
      { headers: NO_STORE }
    )
  }

  if (action === 'audit_test') {
    const restaurantId = url.searchParams.get('restaurantId') ?? ''
    if (!restaurantId) {
      return NextResponse.json(
        { ok: false, error: 'Provide ?restaurantId=<uuid>' },
        { status: 400, headers: NO_STORE }
      )
    }
    const ok = await auditLog({
      restaurantId,
      eventType: 'dev.audit_test',
      eventData: { ts: new Date().toISOString(), note: 'invoked via dev endpoint' },
      actorType: 'system',
      ipAddress: ip,
      userAgent: request.headers.get('user-agent') ?? null,
    })
    return NextResponse.json(
      {
        action: 'audit_test',
        callerIp: redactIp(ip),
        wrote: ok,
        note:
          'Look in Supabase consumer_audit_logs table — newest row should have event_type=dev.audit_test',
      },
      { headers: NO_STORE }
    )
  }

  if (action === 'doorman_test') {
    const restaurantId = url.searchParams.get('restaurantId') ?? ''
    const doormanActionParam = url.searchParams.get('doormanAction') ?? 'booking.create'
    if (!restaurantId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Provide ?restaurantId=<uuid>&doormanAction=booking.create (or order.qr.create / order.takeaway.create / etc.)',
        },
        { status: 400, headers: NO_STORE }
      )
    }
    const check = await assertConsumerWriteAllowed(
      restaurantId,
      doormanActionParam as ConsumerWriteAction
    )
    if (check.ok) {
      return NextResponse.json(
        {
          action: 'doorman_test',
          allowed: true,
          restaurant: {
            slug: check.restaurant.slug,
            status: check.restaurant.status,
            reservations: check.restaurant.service_reservations_enabled,
            qr: check.restaurant.service_qr_enabled,
            takeaway: check.restaurant.service_takeaway_enabled,
          },
        },
        { headers: NO_STORE }
      )
    }
    return NextResponse.json(
      {
        action: 'doorman_test',
        allowed: false,
        ...rejectionPayload(check),
      },
      { status: check.httpStatus, headers: NO_STORE }
    )
  }

  return NextResponse.json(
    {
      ok: false,
      error:
        'Provide ?action=rate_limit_test | rate_limit_real | turnstile_test&token=... | audit_test&restaurantId=... | doorman_test&restaurantId=...&doormanAction=...',
    },
    { status: 400, headers: NO_STORE }
  )
}
