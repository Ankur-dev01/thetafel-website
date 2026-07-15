import 'server-only'
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'
import { redactIp } from './rateLimit'

/**
 * Append-only audit log for consumer-facing actions.
 *
 * Writes to `consumer_audit_logs` via the service-role client (bypasses RLS).
 * The table has no UPDATE or DELETE policy — append only, retained 7 years
 * per Dutch GDPR retention requirements, soft-anonymised when a guest
 * requests erasure (Phase 2 C8.3).
 *
 * Every helper call:
 *   - stamps the timestamp (handled by DB default)
 *   - logs a privacy-safe summary line to Vercel console for live debugging
 *   - swallows any error so an audit failure never breaks the user-visible
 *     action
 *
 * Phase 1 has a sibling `audit_logs` table used by onboarding actions; this
 * helper writes to `consumer_audit_logs` exclusively.
 */

/**
 * Sentinel restaurant_id for audit events that aren't scoped to any single
 * restaurant (e.g. GDPR privacy requests, which may span every restaurant a
 * guest has ever interacted with). consumer_audit_logs.restaurant_id has no
 * FK on this column for this reason — see migration 016.
 */
export const PLATFORM_RESTAURANT_ID = '00000000-0000-0000-0000-000000000000'

export type ConsumerActorType = 'guest' | 'restaurant' | 'system' | 'platform'

export type AuditLogInput = {
  restaurantId: string
  /**
   * Dot-namespaced event name. Examples:
   *   'booking.created', 'booking.cancelled', 'booking.confirmed'
   *   'order.created', 'order.status_changed', 'order.refunded'
   *   'payment.intent_created', 'payment.captured', 'payment.refunded'
   *   'magic_link.consumed', 'magic_link.expired'
   *   'rate_limit.blocked', 'turnstile.rejected'
   *
   * Keep names stable across versions — these get queried during debugging
   * and downstream consumers (analytics, dashboards) match by string.
   */
  eventType: string
  /** Arbitrary structured data describing the event. JSON-serialisable. */
  eventData: Record<string, unknown>
  actorType: ConsumerActorType
  /** UUID of the actor (guest_id / user_id / null for system). */
  actorId?: string | null
  bookingId?: string | null
  orderId?: string | null
  paymentIntentId?: string | null
  /** Caller IP — stored full in DB, redacted in console logs. */
  ipAddress?: string | null
  userAgent?: string | null
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Write a consumer audit log row.
 *
 * Never throws. Always returns true on success, false on failure (caller
 * can ignore the return value — most call sites do).
 *
 * Example:
 *   await auditLog({
 *     restaurantId: r.id,
 *     eventType: 'booking.created',
 *     eventData: { bookingRef, partySize, slotTime, depositCents },
 *     actorType: 'guest',
 *     actorId: guestId,
 *     bookingId: booking.id,
 *     ipAddress: ip,
 *     userAgent: ua,
 *   })
 */
export async function auditLog(input: AuditLogInput): Promise<boolean> {
  try {
    const admin = await createSupabaseServerClientAdmin()
    const { error } = await admin.from('consumer_audit_logs').insert({
      restaurant_id: input.restaurantId,
      event_type: input.eventType,
      event_data: input.eventData,
      actor_type: input.actorType,
      actor_id: input.actorId ?? null,
      booking_id: input.bookingId ?? null,
      order_id: input.orderId ?? null,
      payment_intent_id: input.paymentIntentId ?? null,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
    })

    if (error) {
      console.error('[auditLog] insert failed', {
        eventType: input.eventType,
        restaurantId: input.restaurantId,
        ip: input.ipAddress ? redactIp(input.ipAddress) : null,
        error: error.message,
      })
      return false
    }

    console.log('[audit]', {
      type: input.eventType,
      restaurantId: input.restaurantId,
      actorType: input.actorType,
      bookingId: input.bookingId,
      orderId: input.orderId,
      ip: input.ipAddress ? redactIp(input.ipAddress) : null,
    })

    return true
  } catch (err) {
    console.error('[auditLog] unexpected error', err)
    return false
  }
}
