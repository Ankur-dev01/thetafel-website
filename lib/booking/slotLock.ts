// lib/booking/slotLock.ts
//
// Redis-backed short-lived lock for serializing concurrent booking attempts on
// the same (restaurant, slot). Prevents the "two guests, one table" race
// where both server calls load stale existingBookings during the gap between
// INSERT bookings and INSERT booking_tables.
//
// Usage:
//   const lock = await acquireSlotLock(restaurantId, slotInstantIso);
//   if (!lock.ok) return { error: 'slot_temporarily_busy' };
//   try { ... do the whole create flow ... }
//   finally { await releaseSlotLock(lock.token, restaurantId, slotInstantIso); }
//
// Uses the same Upstash Redis instance as the rate limiter. Fails open with
// an audit trail: if Redis itself is down, the caller is told and can either
// retry or fall through to the DB-level re-check (which still catches most
// races, just not the tiny window we saw in the wild).

import 'server-only';
import { Redis } from '@upstash/redis';

const LOCK_TTL_SECONDS = 15;      // Well above p99 createBooking latency.
const ACQUIRE_RETRIES = 4;         // 4 tries total.
const ACQUIRE_RETRY_DELAY_MS = 120; // 120ms between tries → ~500ms total wait.

let _redis: Redis | null = null;
function getRedis(): Redis {
  if (_redis) return _redis;
  _redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
  return _redis;
}

function lockKey(restaurantId: string, slotInstantIso: string): string {
  return `slotlock:${restaurantId}:${slotInstantIso}`;
}

export type AcquireResult =
  | { ok: true; token: string }
  | { ok: false; reason: 'busy' | 'redis_error' };

/**
 * Acquire an exclusive lock on (restaurantId, slotInstant). Retries briefly
 * before giving up so a normal hand-off between concurrent submits succeeds.
 *
 * The returned `token` must be passed back to `releaseSlotLock` — this ensures
 * we only ever delete our own lock, not one owned by a fresh attempt that
 * came in after our TTL expired.
 */
export async function acquireSlotLock(
  restaurantId: string,
  slotInstantIso: string,
): Promise<AcquireResult> {
  const key = lockKey(restaurantId, slotInstantIso);
  const token = crypto.randomUUID();
  const redis = getRedis();

  for (let attempt = 0; attempt < ACQUIRE_RETRIES; attempt++) {
    try {
      // Atomic set-if-not-exists with TTL. Upstash returns 'OK' on success,
      // null on the key already existing.
      const result = await redis.set(key, token, {
        nx: true,
        ex: LOCK_TTL_SECONDS,
      });
      if (result === 'OK') {
        return { ok: true, token };
      }
    } catch (err) {
      console.error('[slotLock] redis set failed', {
        key,
        attempt,
        err: err instanceof Error ? err.message : String(err),
      });
      return { ok: false, reason: 'redis_error' };
    }

    // Lock currently held by someone else — wait briefly then retry.
    if (attempt < ACQUIRE_RETRIES - 1) {
      await sleep(ACQUIRE_RETRY_DELAY_MS);
    }
  }

  return { ok: false, reason: 'busy' };
}

/**
 * Release the lock only if we still own it (token match). The Lua script is
 * a standard Redlock-style compare-and-delete. Best-effort: any error is
 * logged and swallowed — the TTL will clean up eventually.
 */
export async function releaseSlotLock(
  token: string,
  restaurantId: string,
  slotInstantIso: string,
): Promise<void> {
  const key = lockKey(restaurantId, slotInstantIso);
  const redis = getRedis();

  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;

  try {
    await redis.eval(script, [key], [token]);
  } catch (err) {
    console.warn('[slotLock] release failed (TTL will clean up)', {
      key,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
