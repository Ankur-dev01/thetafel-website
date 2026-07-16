import 'server-only'
import { randomBytes, createHash } from 'node:crypto'
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'
import { auditLog, PLATFORM_RESTAURANT_ID } from './audit'

/**
 * Magic-link token system for guest-facing actions.
 *
 * A magic link is a short-lived, single- or multi-use credential a guest
 * can present (via URL) to perform a specific action without authenticating:
 *
 *   - Manage their booking (view details, cancel)
 *   - Cancel-only (single-use, short TTL — sent in cancellation reminders)
 *   - View their order status (takeaway pickup, QR order tracking)
 *
 * Tokens are 32 random bytes (256 bits), URL-safe-base64 encoded. Only the
 * SHA-256 hash lands in the DB; plaintext is returned by createMagicLink()
 * exactly once and the caller emails it. We never store, log, or echo the
 * plaintext token after creation.
 *
 * Consumption goes through the SECURITY DEFINER RPCs created in C1 — those
 * are the only path through which anonymous users read booking / order data.
 */

export type MagicLinkPurpose =
  | 'manage_booking'   // multi-use; 14-day TTL by default
  | 'cancel_booking'   // single-use; 6-hour TTL by default
  | 'view_order'       // multi-use; 24-hour TTL by default
  | 'data_export'      // single-use; 24-hour TTL by default — no booking/order target
  | 'data_deletion'    // single-use; 24-hour TTL by default — no booking/order target

const DEFAULT_TTL_HOURS: Record<MagicLinkPurpose, number> = {
  manage_booking: 14 * 24, // 14 days
  cancel_booking: 6,       // 6 hours
  view_order: 24,          // 24 hours
  data_export: 24,         // 24 hours
  data_deletion: 24,       // 24 hours
}

const PRIVACY_PURPOSES = new Set<MagicLinkPurpose>(['data_export', 'data_deletion'])

// ── Token primitives ─────────────────────────────────────────────────────────

/**
 * Generate a new magic-link token.
 *
 * 32 bytes of cryptographic randomness, URL-safe-base64 encoded (~43 chars,
 * no padding, no '+' or '/' characters). Safe to embed in URLs and query
 * strings without further encoding.
 */
export function generateMagicLinkToken(): string {
  return randomBytes(32).toString('base64url')
}

/**
 * Hash a magic-link token for storage / lookup.
 *
 * SHA-256, hex encoded — must match what the C1 SECURITY DEFINER functions
 * compute internally (`encode(digest(p_token, 'sha256'), 'hex')`). Don't
 * change either side without changing both.
 */
export function hashMagicLinkToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

// ── createMagicLink ──────────────────────────────────────────────────────────

export type CreateMagicLinkInput = {
  purpose: MagicLinkPurpose
  bookingId?: string | null
  orderId?: string | null
  /** Guest id, for privacy-scoped purposes (data_export) that have no single booking/order target. */
  guestId?: string | null
  /** Locale the request was made in, for privacy-scoped purposes. */
  locale?: string | null
  /** Override the default TTL for this purpose. Hours. */
  ttlHours?: number
  /** Restaurant id, for the audit log. Use the null-UUID sentinel for privacy-scoped purposes. */
  restaurantId: string
  /** Caller IP for the audit log. */
  ipAddress?: string | null
  userAgent?: string | null
}

export type CreateMagicLinkResult =
  | { ok: true; token: string; tokenHash: string; expiresAt: string; magicLinkId: string }
  | { ok: false; reason: 'invalid_target' | 'insert_failed' }

/**
 * Create a new magic link. Inserts a row in `magic_links` and returns the
 * plaintext token (only this once — the hash is what persists).
 *
 * Validates that exactly one of bookingId / orderId is provided, matching
 * the DB CHECK constraint magic_links_target_check.
 *
 * Audits the creation. Caller is responsible for storing the hash on the
 * parent row (bookings.magic_link_token_hash / orders.magic_link_token_hash)
 * if the parent table needs it for direct lookups.
 */
export async function createMagicLink(
  input: CreateMagicLinkInput
): Promise<CreateMagicLinkResult> {
  const hasBooking = !!input.bookingId
  const hasOrder = !!input.orderId
  const isPrivacy = PRIVACY_PURPOSES.has(input.purpose)

  if (isPrivacy) {
    // Privacy-scoped purposes require neither a booking nor an order target.
    if (hasBooking || hasOrder) {
      return { ok: false, reason: 'invalid_target' }
    }
  } else if (hasBooking === hasOrder) {
    // Either both set or neither — both violate the DB target check.
    return { ok: false, reason: 'invalid_target' }
  }

  const token = generateMagicLinkToken()
  const tokenHash = hashMagicLinkToken(token)

  const ttlHours =
    input.ttlHours && input.ttlHours > 0
      ? input.ttlHours
      : DEFAULT_TTL_HOURS[input.purpose]
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString()

  try {
    const admin = await createSupabaseServerClientAdmin()
    const { data, error } = await admin
      .from('magic_links')
      .insert({
        token_hash: tokenHash,
        purpose: input.purpose,
        booking_id: input.bookingId ?? null,
        order_id: input.orderId ?? null,
        guest_id: input.guestId ?? null,
        locale: input.locale ?? null,
        expires_at: expiresAt,
        consume_count: 0,
      })
      .select('id')
      .single()

    if (error || !data) {
      console.error('[createMagicLink] insert failed', {
        purpose: input.purpose,
        bookingId: input.bookingId,
        orderId: input.orderId,
        error: error?.message,
      })
      return { ok: false, reason: 'insert_failed' }
    }

    // Audit the creation. event_data deliberately omits the token / hash —
    // we never want either in audit rows.
    await auditLog({
      restaurantId: input.restaurantId,
      eventType: 'magic_link.created',
      eventData: {
        magicLinkId: data.id,
        purpose: input.purpose,
        bookingId: input.bookingId ?? null,
        orderId: input.orderId ?? null,
        expiresAt,
      },
      actorType: 'system',
      bookingId: input.bookingId ?? null,
      orderId: input.orderId ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    })

    return {
      ok: true,
      token,
      tokenHash,
      expiresAt,
      magicLinkId: data.id as string,
    }
  } catch (err) {
    console.error('[createMagicLink] unexpected error', err)
    return { ok: false, reason: 'insert_failed' }
  }
}

// ── consumeMagicLink ─────────────────────────────────────────────────────────

export type BookingMagicLinkPayload = {
  bookingId: string
  restaurantId: string
  bookingRef: string
  slotTime: string
  partySize: number
  status: string
  depositAmountCents: number | null
  depositCurrency: string | null
  guestFullName: string
  guestEmail: string
  guestPhone: string
  restaurantDisplayName: string | null
  restaurantSlug: string
  cancellationDeadline: string
}

export type OrderMagicLinkPayload = {
  orderId: string
  restaurantId: string
  orderRef: string
  orderType: 'qr' | 'takeaway'
  status: string
  pickupTime: string | null
  totalCents: number
  currency: string
  tableLabel: string | null
  restaurantDisplayName: string | null
  restaurantSlug: string
  items: Array<{
    name: string
    quantity: number
    line_total_cents: number
    notes: string | null
  }>
}

export type ConsumeMagicLinkResult<P extends 'booking' | 'order'> =
  | (P extends 'booking'
      ? { ok: true; kind: 'booking'; payload: BookingMagicLinkPayload }
      : { ok: true; kind: 'order'; payload: OrderMagicLinkPayload })
  | {
      ok: false
      reason:
        | 'invalid_token'
        | 'expired_or_consumed'
        | 'wrong_purpose'
        | 'lookup_failed'
    }

/**
 * Consume a manage-booking or cancel-booking magic link.
 *
 * Calls the SECURITY DEFINER RPC `lookup_booking_by_magic_link`, which:
 *   - hashes the token internally
 *   - finds the matching row
 *   - checks expiry, purpose, and consumed_at
 *   - increments consume_count
 *   - for cancel_booking purpose: marks consumed_at = now() (single-use)
 *   - returns the booking + guest + restaurant fields the manage page needs
 *
 * Returns null payload (with reason) if the token doesn't match anything
 * still valid. Always audits the attempt.
 */
export async function consumeBookingMagicLink(args: {
  token: string
  ipAddress?: string | null
  userAgent?: string | null
}): Promise<ConsumeMagicLinkResult<'booking'>> {
  const { token, ipAddress, userAgent } = args

  if (!token || typeof token !== 'string' || token.length < 20) {
    return { ok: false, reason: 'invalid_token' }
  }

  try {
    const admin = await createSupabaseServerClientAdmin()
    const { data, error } = await admin.rpc('lookup_booking_by_magic_link', {
      p_token: token,
    })

    if (error) {
      console.error('[consumeBookingMagicLink] rpc error', {
        error: error.message,
      })
      return { ok: false, reason: 'lookup_failed' }
    }

    if (!data || (Array.isArray(data) && data.length === 0)) {
      // RPC returns empty set when token doesn't match, expired, or already
      // consumed. We can't distinguish without an extra query — group them
      // as one "expired_or_consumed" reason from the caller's perspective.
      return { ok: false, reason: 'expired_or_consumed' }
    }

    const row = Array.isArray(data) ? data[0] : data
    if (!row) return { ok: false, reason: 'expired_or_consumed' }

    const payload: BookingMagicLinkPayload = {
      bookingId: row.booking_id,
      restaurantId: row.restaurant_id,
      bookingRef: row.booking_ref,
      slotTime: row.slot_time,
      partySize: row.party_size,
      status: row.status,
      depositAmountCents: row.deposit_amount_cents,
      depositCurrency: row.deposit_currency,
      guestFullName: row.guest_full_name,
      guestEmail: row.guest_email,
      guestPhone: row.guest_phone,
      restaurantDisplayName: row.restaurant_display_name,
      restaurantSlug: row.restaurant_slug,
      cancellationDeadline: row.cancellation_deadline,
    }

    await auditLog({
      restaurantId: payload.restaurantId,
      eventType: 'magic_link.consumed',
      eventData: {
        kind: 'booking',
        bookingRef: payload.bookingRef,
      },
      actorType: 'guest',
      bookingId: payload.bookingId,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
    })

    return { ok: true, kind: 'booking', payload }
  } catch (err) {
    console.error('[consumeBookingMagicLink] unexpected error', err)
    return { ok: false, reason: 'lookup_failed' }
  }
}

/**
 * Consume a view-order magic link.
 *
 * Parallel to consumeBookingMagicLink but for orders. Calls
 * `lookup_order_by_magic_link` which returns the order + items + restaurant.
 * Never marks consumed_at (view_order is multi-use within the TTL).
 */
export async function consumeOrderMagicLink(args: {
  token: string
  ipAddress?: string | null
  userAgent?: string | null
}): Promise<ConsumeMagicLinkResult<'order'>> {
  const { token, ipAddress, userAgent } = args

  if (!token || typeof token !== 'string' || token.length < 20) {
    return { ok: false, reason: 'invalid_token' }
  }

  try {
    const admin = await createSupabaseServerClientAdmin()
    const { data, error } = await admin.rpc('lookup_order_by_magic_link', {
      p_token: token,
    })

    if (error) {
      console.error('[consumeOrderMagicLink] rpc error', { error: error.message })
      return { ok: false, reason: 'lookup_failed' }
    }

    if (!data || (Array.isArray(data) && data.length === 0)) {
      return { ok: false, reason: 'expired_or_consumed' }
    }

    const row = Array.isArray(data) ? data[0] : data
    if (!row) return { ok: false, reason: 'expired_or_consumed' }

    const payload: OrderMagicLinkPayload = {
      orderId: row.order_id,
      restaurantId: row.restaurant_id,
      orderRef: row.order_ref,
      orderType: row.order_type,
      status: row.status,
      pickupTime: row.pickup_time,
      totalCents: row.total_cents,
      currency: row.currency,
      tableLabel: row.table_label,
      restaurantDisplayName: row.restaurant_display_name,
      restaurantSlug: row.restaurant_slug,
      items: Array.isArray(row.items) ? row.items : [],
    }

    await auditLog({
      restaurantId: payload.restaurantId,
      eventType: 'magic_link.consumed',
      eventData: {
        kind: 'order',
        orderRef: payload.orderRef,
      },
      actorType: 'guest',
      orderId: payload.orderId,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
    })

    return { ok: true, kind: 'order', payload }
  } catch (err) {
    console.error('[consumeOrderMagicLink] unexpected error', err)
    return { ok: false, reason: 'lookup_failed' }
  }
}

// ── consumePrivacyMagicLink ──────────────────────────────────────────────────

export type PrivacyMagicLinkPayload = {
  magicLinkId: string
  guestId: string
  locale: 'nl' | 'en'
}

export type ConsumePrivacyMagicLinkResult =
  | { ok: true; payload: PrivacyMagicLinkPayload }
  | { ok: false; reason: 'invalid_token' | 'expired_or_consumed' | 'lookup_failed' }

/**
 * Consume a privacy-scoped magic link (data_export).
 *
 * Unlike booking/order consumption, this never goes through a SECURITY
 * DEFINER RPC — every caller already runs server-side with the admin
 * (service-role) client, which bypasses RLS directly, so a single atomic
 * UPDATE ... WHERE ... RETURNING gives the same single-use guarantee as the
 * RPCs without new PL/pgSQL. Single-use: sets consumed_at on first success.
 */
export async function consumePrivacyMagicLink(args: {
  token: string
  purpose: Extract<MagicLinkPurpose, 'data_export' | 'data_deletion'>
  ipAddress?: string | null
  userAgent?: string | null
}): Promise<ConsumePrivacyMagicLinkResult> {
  const { token, purpose, ipAddress, userAgent } = args

  if (!token || typeof token !== 'string' || token.length < 20) {
    return { ok: false, reason: 'invalid_token' }
  }

  const tokenHash = hashMagicLinkToken(token)

  try {
    const admin = await createSupabaseServerClientAdmin()
    const nowIso = new Date().toISOString()

    const { data, error } = await admin
      .from('magic_links')
      .update({ consumed_at: nowIso, consume_count: 1 })
      .eq('token_hash', tokenHash)
      .eq('purpose', purpose)
      .is('consumed_at', null)
      .gt('expires_at', nowIso)
      .select('id, guest_id, locale')
      .maybeSingle()

    if (error) {
      console.error('[consumePrivacyMagicLink] update error', { error: error.message })
      return { ok: false, reason: 'lookup_failed' }
    }

    if (!data || !data.guest_id) {
      // No row matched — invalid, expired, or already consumed. Deliberately
      // not distinguished, same oracle-avoidance as the booking/order paths.
      return { ok: false, reason: 'expired_or_consumed' }
    }

    const locale: 'nl' | 'en' = data.locale === 'en' ? 'en' : 'nl'
    const payload: PrivacyMagicLinkPayload = {
      magicLinkId: data.id as string,
      guestId: data.guest_id as string,
      locale,
    }

    await auditLog({
      restaurantId: PLATFORM_RESTAURANT_ID,
      eventType: 'magic_link.consumed',
      eventData: { kind: 'privacy', purpose },
      actorType: 'guest',
      actorId: payload.guestId,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
    })

    return { ok: true, payload }
  } catch (err) {
    console.error('[consumePrivacyMagicLink] unexpected error', err)
    return { ok: false, reason: 'lookup_failed' }
  }
}
