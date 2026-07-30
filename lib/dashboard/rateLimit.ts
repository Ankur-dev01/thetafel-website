// lib/dashboard/rateLimit.ts
//
// Thin dashboard-scoped wrapper around the same Upstash pattern used by
// lib/consumer/rateLimit.ts. A separate module (not a new key in
// CONSUMER_LIMITS) because that map is semantically consumer-only; dashboard
// mutations are keyed by staff user id, not caller IP.

import 'server-only';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const WINDOW = '1 m';
const MAX = 20;
const PREFIX = 'dash:booking_actions';

let _redis: Redis | null = null;
function getRedis(): Redis {
  if (_redis) return _redis;
  _redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
  return _redis;
}

let _limiter: Ratelimit | null = null;
function getLimiter(): Ratelimit {
  if (_limiter) return _limiter;
  _limiter = new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(MAX, WINDOW),
    prefix: PREFIX,
    analytics: false,
  });
  return _limiter;
}

export type DashboardRateLimitResult = {
  ok: boolean;
  retryAfter?: number;
};

/**
 * 20 mutating booking-action requests per minute per staff user. Same
 * dev-mode bypass convention as lib/consumer/rateLimit.ts so local dev and
 * Playwright runs (NODE_ENV=development) don't fight Redis quotas.
 */
export async function dashboardMutationRateLimit(userId: string): Promise<DashboardRateLimitResult> {
  if (process.env.NODE_ENV === 'development') {
    return { ok: true };
  }

  const result = await getLimiter().limit(`user:${userId}:dashboard_booking_actions`);
  if (result.success) return { ok: true };

  const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
  return { ok: false, retryAfter };
}
