import 'server-only'
import { createHash } from 'node:crypto'
import { Ratelimit, type Duration } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import type { NextRequest } from 'next/server'
import { normalizePhone } from './sanitize'

/**
 * Centralised rate-limit configuration for consumer endpoints.
 *
 * Add new keys here when introducing new public endpoints. Every entry is a
 * sliding window. Window strings are Upstash's standard format ('30 s', '1 m',
 * '1 h', etc.). Prefixes must be unique — they're the Redis key namespace.
 *
 * Tuning notes:
 *  - Submit-style endpoints (booking, order) get tight limits — a real human
 *    hits these at most a couple of times per minute.
 *  - Resend / cancel actions get tighter still, since they're idempotent-ish
 *    and abuse means email spam to a real guest.
 *  - Availability queries (lookups while picking a slot / browsing) get
 *    generous limits — a normal user fires many of these.
 */
export const CONSUMER_LIMITS = {
  booking_submit:        { window: '1 m',  max: 5,   prefix: 'csm:book' },
  booking_cancel:        { window: '1 h',  max: 5,   prefix: 'csm:bcan' },
  order_submit:          { window: '1 m',  max: 8,   prefix: 'csm:ord' },
  availability_query:    { window: '1 m',  max: 60,  prefix: 'csm:avail' },
  menu_view:             { window: '1 m',  max: 120, prefix: 'csm:menu' },
  magic_link_consume:    { window: '15 m', max: 10,  prefix: 'csm:ml' },
  magic_link_resend:     { window: '1 h',  max: 3,   prefix: 'csm:mlre' },
  deposit_start:         { window: '1 h',  max: 5,   prefix: 'csm:dep' },
  order_status_poll:     { window: '1 m',  max: 30,  prefix: 'csm:ostat' },
  data_request:          { window: '1 h',  max: 3,   prefix: 'csm:dreq' },
  booking_email_phone:   { window: '1 h',  max: 3,   prefix: 'csm:bkep' },
  order_email_phone:     { window: '1 h',  max: 5,   prefix: 'csm:orep' },
} as const

export type ConsumerLimitKey = keyof typeof CONSUMER_LIMITS

// ── Lazy singletons keyed by limit name ──────────────────────────────────────
// Re-creating the Upstash client per request is fine but slow. Cache one
// instance per limit key for the lifetime of the serverless container.

let _redis: Redis | null = null
function getRedis(): Redis {
  if (_redis) return _redis
  _redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })
  return _redis
}

const _limiters = new Map<ConsumerLimitKey, Ratelimit>()
function getLimiter(key: ConsumerLimitKey): Ratelimit {
  const cached = _limiters.get(key)
  if (cached) return cached
  const cfg = CONSUMER_LIMITS[key]
  const limiter = new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(cfg.max, cfg.window as Duration),
    prefix: cfg.prefix,
    analytics: false,
  })
  _limiters.set(key, limiter)
  return limiter
}

// ── IP extraction ────────────────────────────────────────────────────────────

/**
 * Best-effort caller IP from request headers.
 *
 * Vercel sets `x-forwarded-for` to a comma-separated list; the first entry is
 * the original client. Falls back to `x-real-ip`, then to '127.0.0.1' for
 * local dev so we always have a valid discriminator.
 */
export function getCallerIp(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  const xRealIp = request.headers.get('x-real-ip')
  if (xRealIp) return xRealIp
  return '127.0.0.1'
}

/**
 * Privacy-safe IP redaction for logs.
 *
 * "82.94.140.213" → "82.94.x.x"   (IPv4)
 * "2001:db8::1234" → "2001:db8:x:x"  (IPv6 — first two segments only)
 */
export function redactIp(ip: string): string {
  if (!ip || typeof ip !== 'string') return 'unknown'
  if (ip.includes(':')) {
    const parts = ip.split(':')
    return `${parts[0] ?? ''}:${parts[1] ?? ''}:x:x`
  }
  const parts = ip.split('.')
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.x.x`
  return 'unknown'
}

// ── Public API ───────────────────────────────────────────────────────────────

export type RateLimitResult = {
  allowed: boolean
  /** Rate limit window in milliseconds remaining until reset. */
  retryAfterSeconds: number
  /** Total allowed per window for this key. */
  limit: number
  /** Remaining allowed before reset. 0 when blocked. */
  remaining: number
  /** Whether dev mode bypassed the check. */
  bypassed: boolean
}

/**
 * Check the rate limit for a consumer endpoint.
 *
 * `discriminator` is the per-actor key — usually the caller IP for anonymous
 * endpoints, the user id for authenticated ones. Same discriminator + same
 * limit key share a bucket.
 *
 * In `NODE_ENV === 'development'` the check always returns allowed=true with
 * bypassed=true so local dev doesn't fight Redis quotas. Preview and
 * production environments enforce normally.
 */
export async function checkConsumerRateLimit(
  key: ConsumerLimitKey,
  discriminator: string
): Promise<RateLimitResult> {
  const cfg = CONSUMER_LIMITS[key]
  const limit = cfg.max

  if (process.env.NODE_ENV === 'development') {
    return {
      allowed: true,
      retryAfterSeconds: 0,
      limit,
      remaining: limit,
      bypassed: true,
    }
  }

  const limiter = getLimiter(key)
  const result = await limiter.limit(discriminator)
  const retryAfterSeconds = Math.max(
    0,
    Math.ceil((result.reset - Date.now()) / 1000)
  )

  return {
    allowed: result.success,
    retryAfterSeconds,
    limit: result.limit,
    remaining: result.remaining,
    bypassed: false,
  }
}

/**
 * Discriminator for the (email, phone) limiter — a truncated hash so raw PII
 * never ends up as a Redis key. Reuses normalizePhone (lib/consumer/sanitize)
 * rather than reimplementing phone normalisation, so the same guest hitting
 * this from "0612345678" and "+31612345678" hashes to the same bucket.
 */
function buildEmailPhoneDiscriminator(email: string, phone: string): string {
  const normalizedEmail = email.trim().toLowerCase()
  const normalizedPhone = normalizePhone(phone) ?? phone.trim()
  return createHash('sha256')
    .update(`${normalizedEmail}|${normalizedPhone}`)
    .digest('hex')
    .slice(0, 32)
}

/**
 * Rate-limit by (email, phone) identity rather than IP — catches a single
 * guest spamming bookings/orders across rotating IPs. Delegates to
 * checkConsumerRateLimit so it shares the same Redis client, sliding-window
 * behaviour, dev-mode bypass, and failure mode as every IP-keyed limit above
 * — no separate Redis wiring to keep in sync.
 *
 * `scope` keeps booking and order limits counted independently — maxing out
 * the booking limit must not block an unrelated takeaway order from the same
 * guest.
 */
export async function checkEmailPhoneRateLimit(
  email: string,
  phone: string,
  scope: 'booking' | 'order',
): Promise<RateLimitResult> {
  const key: ConsumerLimitKey = scope === 'booking' ? 'booking_email_phone' : 'order_email_phone'
  const discriminator = buildEmailPhoneDiscriminator(email, phone)
  return checkConsumerRateLimit(key, discriminator)
}

/**
 * Headers to attach to a 429 response.
 *
 * Includes `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`,
 * `X-RateLimit-Reset`. Standard pattern; callers spread these into the
 * response init's headers field.
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'Retry-After': String(Math.max(1, result.retryAfterSeconds)),
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(
      Math.floor(Date.now() / 1000) + Math.max(1, result.retryAfterSeconds)
    ),
  }
}
