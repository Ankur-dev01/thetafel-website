// lib/orders/createTakeawayOrder.ts
//
// Server-authoritative takeaway order write. Mirrors createPayNowOrder (QR,
// C5.5) closely — same re-price logic, same idempotency check, same
// magic-link token generation — but adds a guest upsert and stamps
// pickup_time, order_type='takeaway', no table linkage, no tab.
//
// Guest upsert mirrors lib/booking/createBooking.ts's pattern exactly:
// guests is a global table (no restaurant_id column), looked up by
// email_lower (a generated column — never inserted directly), with
// full_name/phone/email as the writable identity fields.
//
// payment_status = 'pending' at creation; the Mollie webhook flips it to
// 'paid' and the order to 'confirmed'.

import 'server-only'
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'
import { generateOrderRef } from './generateOrderRef'
import { generateMagicLinkToken, hashMagicLinkToken } from '@/lib/consumer/magicLinks'
import { sanitizeSingleLine, sanitizeMultiLine } from '@/lib/consumer/sanitize'

const IDEMPOTENCY_LOOKBACK_MINUTES = 10
const VIEW_ORDER_TTL_HOURS = 48 // takeaway magic link lives longer than QR
const ITEM_NOTE_MAX_LEN = 140
const GUEST_NOTE_MAX_LEN = 200

export type TakeawayLine = {
  menuItemId: string
  quantity: number
  itemNote?: string | null
}

export type CreateTakeawayOrderInput = {
  restaurantId: string
  pickupInstant: string // ISO UTC
  lines: TakeawayLine[]
  guestName: string
  guestPhoneE164: string // already validated to E.164 by the API layer
  guestEmail: string
  guestNote?: string | null
  idempotencyKey: string
}

export type ItemRejection = {
  menuItemId: string
  reason: 'not_found' | 'not_visible_takeaway' | 'not_available' | 'wrong_restaurant'
}

export type CreateTakeawayOrderResult =
  | {
      ok: true
      orderId: string
      orderRef: string
      guestId: string
      subtotalCents: number
      vatCents: number
      totalCents: number
      currency: string
      magicLinkPlaintext: string
      idempotentReplay: boolean
    }
  | { ok: false; error: 'items_invalid'; rejections: ItemRejection[] }
  | { ok: false; error: 'no_items' | 'below_minimum'; minOrderCents?: number }
  | { ok: false; error: 'db_error'; message?: string }
  | { ok: false; error: 'guest_upsert_failed'; message?: string }

export async function createTakeawayOrder(
  input: CreateTakeawayOrderInput,
): Promise<CreateTakeawayOrderResult> {
  if (input.lines.length === 0) return { ok: false, error: 'no_items' }
  const admin = await createSupabaseServerClientAdmin()

  // ── Idempotency check ──────────────────────────────────────────────────
  const { data: existing } = await admin
    .from('orders')
    .select('id, order_ref, guest_id, subtotal_cents, vat_cents, total_cents, currency')
    .eq('idempotency_key', input.idempotencyKey)
    .eq('restaurant_id', input.restaurantId)
    .eq('order_type', 'takeaway')
    .gte('created_at', new Date(Date.now() - IDEMPOTENCY_LOOKBACK_MINUTES * 60_000).toISOString())
    .maybeSingle()

  if (existing) {
    return {
      ok: true,
      orderId: existing.id,
      orderRef: existing.order_ref,
      guestId: existing.guest_id!,
      subtotalCents: existing.subtotal_cents,
      vatCents: existing.vat_cents,
      totalCents: existing.total_cents,
      currency: existing.currency,
      magicLinkPlaintext: '',
      idempotentReplay: true,
    }
  }

  // ── Load restaurant config we need here ────────────────────────────────
  const { data: cfg } = await admin
    .from('restaurants')
    .select('takeaway_min_order_cents')
    .eq('id', input.restaurantId)
    .maybeSingle()
  const minOrderCents = cfg?.takeaway_min_order_cents ?? 0

  // ── Re-fetch every line item authoritatively ───────────────────────────
  const uniqueItemIds = Array.from(new Set(input.lines.map((l) => l.menuItemId)))
  const { data: menuRows, error: menuErr } = await admin
    .from('menu_items')
    .select('id, restaurant_id, name_nl, price_cents, vat_rate_bp, visible_takeaway, available')
    .in('id', uniqueItemIds)
  if (menuErr) return { ok: false, error: 'db_error', message: menuErr.message }

  const byId = new Map((menuRows ?? []).map((r) => [r.id, r]))
  const rejections: ItemRejection[] = []
  for (const line of input.lines) {
    const row = byId.get(line.menuItemId)
    if (!row) {
      rejections.push({ menuItemId: line.menuItemId, reason: 'not_found' })
      continue
    }
    if (row.restaurant_id !== input.restaurantId) {
      rejections.push({ menuItemId: line.menuItemId, reason: 'wrong_restaurant' })
      continue
    }
    if (!row.visible_takeaway) {
      rejections.push({ menuItemId: line.menuItemId, reason: 'not_visible_takeaway' })
      continue
    }
    if (!row.available) {
      rejections.push({ menuItemId: line.menuItemId, reason: 'not_available' })
      continue
    }
  }
  if (rejections.length > 0) return { ok: false, error: 'items_invalid', rejections }

  // ── Compute totals (Dutch VAT-inclusive convention — same as QR) ───────
  let subtotalCents = 0
  let vatCents = 0
  const orderItemRows: Array<{
    menu_item_id: string
    name_snapshot: string
    quantity: number
    unit_price_cents: number
    line_total_cents: number
    item_notes: string | null
    currency: string
  }> = []

  for (const line of input.lines) {
    const row = byId.get(line.menuItemId)!
    const unit = row.price_cents
    const qty = line.quantity
    const lineTotal = unit * qty
    const bp = row.vat_rate_bp ?? 0
    const lineVat = bp > 0 ? Math.round((lineTotal * bp) / (10000 + bp)) : 0
    subtotalCents += lineTotal
    vatCents += lineVat
    const cleanItemNote = line.itemNote ? sanitizeSingleLine(line.itemNote, ITEM_NOTE_MAX_LEN) : null
    orderItemRows.push({
      menu_item_id: row.id,
      name_snapshot: row.name_nl,
      quantity: qty,
      unit_price_cents: unit,
      line_total_cents: lineTotal,
      item_notes: cleanItemNote,
      currency: 'EUR',
    })
  }

  const totalCents = subtotalCents
  if (totalCents < minOrderCents) {
    return { ok: false, error: 'below_minimum', minOrderCents }
  }

  const cleanGuestNote = input.guestNote ? sanitizeMultiLine(input.guestNote, GUEST_NOTE_MAX_LEN) : null

  // ── Upsert guest ───────────────────────────────────────────────────────
  // guests has no restaurant_id column — it's a global, cross-restaurant
  // table keyed by email_lower (generated, never inserted directly).
  const emailNormalized = input.guestEmail.trim().toLowerCase()

  const { data: guestExisting, error: guestLookupErr } = await admin
    .from('guests')
    .select('id')
    .eq('email_lower', emailNormalized)
    .maybeSingle()

  if (guestLookupErr) {
    return { ok: false, error: 'guest_upsert_failed', message: guestLookupErr.message }
  }

  let guestId: string
  if (guestExisting) {
    guestId = guestExisting.id
    const { error: guestUpdErr } = await admin
      .from('guests')
      .update({ full_name: input.guestName.trim(), phone: input.guestPhoneE164 })
      .eq('id', guestId)
    if (guestUpdErr) {
      // Soft-fail: order continues with the existing guest row as-is.
      console.error('[createTakeawayOrder] guest update failed', guestUpdErr.message)
    }
  } else {
    const { data: guestNew, error: guestErr } = await admin
      .from('guests')
      .insert({
        full_name: input.guestName.trim(),
        email: input.guestEmail.trim(),
        phone: input.guestPhoneE164,
      })
      .select('id')
      .single()
    if (guestErr || !guestNew) {
      return {
        ok: false,
        error: 'guest_upsert_failed',
        message: guestErr?.message ?? 'guest insert returned no row',
      }
    }
    guestId = guestNew.id
  }

  // ── Refs + magic link ──────────────────────────────────────────────────
  const orderRef = await generateOrderRef('PU') // PU = pickup
  const magicLinkPlaintext = generateMagicLinkToken()
  const magicLinkHash = hashMagicLinkToken(magicLinkPlaintext)

  // ── Insert order ───────────────────────────────────────────────────────
  const { data: order, error: orderErr } = await admin
    .from('orders')
    .insert({
      restaurant_id: input.restaurantId,
      order_type: 'takeaway' as const,
      status: 'pending' as const,
      payment_status: 'pending' as const,
      order_ref: orderRef,
      guest_id: guestId,
      pickup_time: input.pickupInstant,
      subtotal_cents: subtotalCents,
      vat_cents: vatCents,
      total_cents: totalCents,
      currency: 'EUR',
      guest_note: cleanGuestNote,
      magic_link_token_hash: magicLinkHash,
      idempotency_key: input.idempotencyKey,
    })
    .select('id')
    .single()

  if (orderErr || !order) {
    return { ok: false, error: 'db_error', message: orderErr?.message ?? 'orders insert returned no row' }
  }

  // ── Insert order items ─────────────────────────────────────────────────
  const itemInsertRows = orderItemRows.map((r) => ({ ...r, order_id: order.id }))
  const { error: itemsErr } = await admin.from('order_items').insert(itemInsertRows)
  if (itemsErr) {
    await admin.from('orders').delete().eq('id', order.id)
    return { ok: false, error: 'db_error', message: itemsErr.message }
  }

  // ── Insert magic_links row ─────────────────────────────────────────────
  const expiresAt = new Date(Date.now() + VIEW_ORDER_TTL_HOURS * 60 * 60 * 1000).toISOString()
  const { error: mlErr } = await admin.from('magic_links').insert({
    token_hash: magicLinkHash,
    purpose: 'view_order' as const,
    order_id: order.id,
    expires_at: expiresAt,
  })
  if (mlErr) {
    // Non-fatal — the order row has the hash too.
    console.error('[createTakeawayOrder] magic_links insert failed', mlErr.message)
  }

  return {
    ok: true,
    orderId: order.id,
    orderRef,
    guestId,
    subtotalCents,
    vatCents,
    totalCents,
    currency: 'EUR',
    magicLinkPlaintext,
    idempotentReplay: false,
  }
}
