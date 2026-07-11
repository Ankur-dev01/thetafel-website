// lib/orders/transactionalInsert.ts
//
// Server-authoritative order write. Re-fetches every menu item, recomputes
// prices and VAT from menu_items.price_cents and vat_rate_bp, inserts orders,
// order_items, and magic_links rows in the correct order.
//
// Two exported entry points:
//   createPayNowOrder     — inserts orders in status='pending', payment_status='pending'.
//                           Payment intent creation happens in the route.
//   createPayAtTableOrder — inserts orders in status='confirmed', payment_status='open_tab',
//                           links to a tab (opened or joined), updates tabs.total_cents.
//
// Both share writeOrder() which does the reprice + insert + magic link work.
//
// Idempotency: caller passes idempotencyKey (a UUID from the client). If an
// existing orders row has the same idempotency_key + restaurant_id and was
// created within the last 10 minutes, we return that order instead of
// creating a new one. Applies to both branches.
//
// VAT convention: menu_items.price_cents is gross (VAT-inclusive), matching
// the Dutch hospitality convention already used by the cart's own pricing
// (lib/cart/pricing.ts). subtotal_cents == total_cents; vat_cents is the
// portion of that total that is VAT, extracted per line and rounded.

import 'server-only'
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'
import { generateOrderRef } from './generateOrderRef'
import { openOrJoinTab, releaseTabLock } from './openOrJoinTab'
import { generateMagicLinkToken, hashMagicLinkToken } from '@/lib/consumer/magicLinks'
import { sanitizeSingleLine, sanitizeMultiLine } from '@/lib/consumer/sanitize'

const IDEMPOTENCY_LOOKBACK_MINUTES = 10
const VIEW_ORDER_TTL_HOURS = 24
const ITEM_NOTE_MAX_LEN = 140
const GUEST_NOTE_MAX_LEN = 200

export type ClientOrderLine = {
  menuItemId: string
  quantity: number
  itemNote?: string | null
}

export type CreatePayNowOrderInput = {
  restaurantId: string
  tableId: string
  lines: ClientOrderLine[]
  guestNote?: string | null
  idempotencyKey: string
}

export type CreatePayAtTableOrderInput = CreatePayNowOrderInput

export type ItemRejection = {
  menuItemId: string
  reason: 'not_found' | 'not_visible_qr' | 'not_available' | 'wrong_restaurant'
}

export type CreateOrderResult =
  | {
      ok: true
      orderId: string
      orderRef: string
      subtotalCents: number
      vatCents: number
      totalCents: number
      currency: string
      magicLinkPlaintext: string
      tabId: string | null
      idempotentReplay: boolean
    }
  | { ok: false; error: 'items_invalid'; rejections: ItemRejection[] }
  | { ok: false; error: 'no_items' }
  | { ok: false; error: 'tab_busy' | 'tab_error'; message?: string }
  | { ok: false; error: 'db_error'; message?: string }

// ── Public entry points ──────────────────────────────────────────────────────

export async function createPayNowOrder(
  input: CreatePayNowOrderInput,
): Promise<CreateOrderResult> {
  return writeOrder(input, {
    paymentStatus: 'pending',
    status: 'pending',
    linkTab: false,
  })
}

export async function createPayAtTableOrder(
  input: CreatePayAtTableOrderInput,
): Promise<CreateOrderResult> {
  return writeOrder(input, {
    paymentStatus: 'open_tab',
    status: 'confirmed',
    linkTab: true,
  })
}

// ── Core ─────────────────────────────────────────────────────────────────────

async function writeOrder(
  input: CreatePayNowOrderInput,
  mode: {
    paymentStatus: 'pending' | 'open_tab'
    status: 'pending' | 'confirmed'
    linkTab: boolean
  },
): Promise<CreateOrderResult> {
  if (input.lines.length === 0) {
    return { ok: false, error: 'no_items' }
  }

  const admin = await createSupabaseServerClientAdmin()

  // ── Idempotency check ──────────────────────────────────────────────────
  const { data: existing } = await admin
    .from('orders')
    .select('id, order_ref, subtotal_cents, vat_cents, total_cents, currency, tab_id')
    .eq('idempotency_key', input.idempotencyKey)
    .eq('restaurant_id', input.restaurantId)
    .gte('created_at', new Date(Date.now() - IDEMPOTENCY_LOOKBACK_MINUTES * 60_000).toISOString())
    .maybeSingle()

  if (existing) {
    // Replay — return the existing order. Magic link is empty because we
    // don't hand out fresh tokens on replay; the client should have the
    // original response cached.
    return {
      ok: true,
      orderId: existing.id,
      orderRef: existing.order_ref,
      subtotalCents: existing.subtotal_cents,
      vatCents: existing.vat_cents,
      totalCents: existing.total_cents,
      currency: existing.currency,
      magicLinkPlaintext: '',
      tabId: existing.tab_id,
      idempotentReplay: true,
    }
  }

  // ── Re-fetch every line item authoritatively ───────────────────────────
  const uniqueItemIds = Array.from(new Set(input.lines.map((l) => l.menuItemId)))
  const { data: menuRows, error: menuErr } = await admin
    .from('menu_items')
    .select('id, restaurant_id, name_nl, price_cents, vat_rate_bp, visible_qr, available')
    .in('id', uniqueItemIds)

  if (menuErr) {
    console.error('[transactionalInsert] menu_items lookup failed', menuErr.message)
    return { ok: false, error: 'db_error', message: menuErr.message }
  }

  const byId = new Map((menuRows ?? []).map((row) => [row.id, row]))

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
    if (!row.visible_qr) {
      rejections.push({ menuItemId: line.menuItemId, reason: 'not_visible_qr' })
      continue
    }
    if (!row.available) {
      rejections.push({ menuItemId: line.menuItemId, reason: 'not_available' })
      continue
    }
  }
  if (rejections.length > 0) {
    return { ok: false, error: 'items_invalid', rejections }
  }

  // ── Compute totals (VAT-inclusive Dutch hospitality convention) ────────
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

    const cleanNote = line.itemNote
      ? sanitizeSingleLine(line.itemNote, ITEM_NOTE_MAX_LEN)
      : null

    orderItemRows.push({
      menu_item_id: row.id,
      name_snapshot: row.name_nl,
      quantity: qty,
      unit_price_cents: unit,
      line_total_cents: lineTotal,
      item_notes: cleanNote,
      currency: 'EUR',
    })
  }

  const totalCents = subtotalCents
  const currency = 'EUR'

  const cleanGuestNote = input.guestNote
    ? sanitizeMultiLine(input.guestNote, GUEST_NOTE_MAX_LEN)
    : null

  // ── Tab handling (pay-at-table only) ───────────────────────────────────
  let tabId: string | null = null
  let tabLockToken: string | null = null
  let tabWasCreated = false

  if (mode.linkTab) {
    const tabResult = await openOrJoinTab(input.restaurantId, input.tableId)
    if (!tabResult.ok) {
      return {
        ok: false,
        error: tabResult.reason === 'busy' ? 'tab_busy' : 'tab_error',
        message: tabResult.reason === 'busy' ? undefined : tabResult.message,
      }
    }
    tabId = tabResult.tabId
    tabLockToken = tabResult.lockToken
    tabWasCreated = tabResult.created
  }

  try {
    // ── Generate refs and magic link ──────────────────────────────────────
    const orderRef = await generateOrderRef('QR')
    const magicLinkPlaintext = generateMagicLinkToken()
    const magicLinkHash = hashMagicLinkToken(magicLinkPlaintext)

    // ── Insert orders row ─────────────────────────────────────────────────
    const { data: order, error: orderErr } = await admin
      .from('orders')
      .insert({
        restaurant_id: input.restaurantId,
        order_type: 'qr' as const,
        status: mode.status,
        payment_status: mode.paymentStatus,
        order_ref: orderRef,
        table_id: input.tableId,
        tab_id: tabId,
        subtotal_cents: subtotalCents,
        vat_cents: vatCents,
        total_cents: totalCents,
        currency,
        guest_note: cleanGuestNote,
        magic_link_token_hash: magicLinkHash,
        idempotency_key: input.idempotencyKey,
      })
      .select('id')
      .single()

    if (orderErr || !order) {
      console.error('[transactionalInsert] orders insert failed', orderErr?.message)
      return {
        ok: false,
        error: 'db_error',
        message: orderErr?.message ?? 'orders insert returned no row',
      }
    }

    // ── Insert order_items rows ───────────────────────────────────────────
    const itemInsertRows = orderItemRows.map((row) => ({ ...row, order_id: order.id }))
    const { error: itemsErr } = await admin.from('order_items').insert(itemInsertRows)
    if (itemsErr) {
      // Roll back the orders row so we don't leak an empty order.
      await admin.from('orders').delete().eq('id', order.id)
      if (tabWasCreated && tabId) {
        await admin.from('tabs').delete().eq('id', tabId).eq('total_cents', 0)
      }
      return { ok: false, error: 'db_error', message: itemsErr.message }
    }

    // ── Insert magic_links row (for view_order lookup RPC) ────────────────
    const expiresAt = new Date(Date.now() + VIEW_ORDER_TTL_HOURS * 60 * 60 * 1000).toISOString()
    const { error: mlErr } = await admin.from('magic_links').insert({
      token_hash: magicLinkHash,
      purpose: 'view_order' as const,
      order_id: order.id,
      expires_at: expiresAt,
    })
    if (mlErr) {
      // Not fatal — the order exists and orders.magic_link_token_hash is set.
      console.error('[transactionalInsert] magic_links insert failed', mlErr.message)
    }

    // ── Bump tab total ────────────────────────────────────────────────────
    if (mode.linkTab && tabId) {
      const { data: tabRow } = await admin
        .from('tabs')
        .select('total_cents')
        .eq('id', tabId)
        .single()
      const newTotal = (tabRow?.total_cents ?? 0) + totalCents
      await admin
        .from('tabs')
        .update({ total_cents: newTotal, updated_at: new Date().toISOString() })
        .eq('id', tabId)
    }

    return {
      ok: true,
      orderId: order.id,
      orderRef,
      subtotalCents,
      vatCents,
      totalCents,
      currency,
      magicLinkPlaintext,
      tabId,
      idempotentReplay: false,
    }
  } finally {
    if (tabLockToken) {
      await releaseTabLock(tabLockToken, input.restaurantId, input.tableId)
    }
  }
}
