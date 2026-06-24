import { NextRequest, NextResponse } from 'next/server'
import {
  checkConsumerRateLimit,
  getCallerIp,
  rateLimitHeaders,
  redactIp,
} from '@/lib/consumer/rateLimit'
import { verifyTurnstileToken } from '@/lib/consumer/turnstile'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' }

/**
 * Dev-only sanity check for the security primitives.
 *
 * Hard-404 in production. Use locally to verify rate-limit and Turnstile
 * helpers wire correctly before any real consumer endpoint depends on them.
 *
 *   GET /api/dev/security-check?action=rate_limit_test
 *     → fires checkConsumerRateLimit on the 'booking_submit' bucket with
 *       NODE_ENV bypass active in dev (always returns allowed=true,
 *       bypassed=true). Useful only as a smoke test.
 *
 *   GET /api/dev/security-check?action=rate_limit_real
 *     → temporarily skips the dev bypass by going around the helper to
 *       confirm Upstash is reachable. Hits 'csm:devcheck' bucket with a
 *       3/minute window. After 3 hits in a minute returns allowed=false.
 *
 *   GET /api/dev/security-check?action=turnstile_test&token=XYZ
 *     → calls verifyTurnstileToken with the supplied token. With no
 *       TURNSTILE_SECRET_KEY env var set, returns ok=true with reason
 *       'dev_bypass'. With Cloudflare test keys configured, returns the
 *       answer Cloudflare promises for that token.
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
    // Reach into the helper internals deliberately for the smoke test.
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

  return NextResponse.json(
    {
      ok: false,
      error:
        'Provide ?action=rate_limit_test, ?action=rate_limit_real, or ?action=turnstile_test&token=...',
    },
    { status: 400, headers: NO_STORE }
  )
}
