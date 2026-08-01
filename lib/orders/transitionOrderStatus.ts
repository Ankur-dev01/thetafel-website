// lib/orders/transitionOrderStatus.ts
//
// Application-level guard for orders.status transitions.
// Terminal statuses (completed, refunded) cannot regress.
//
// The permitted graph mirrors the order_status enum / PRD status flow:
//
//   pending → confirmed | cancelled
//   confirmed → preparing | cancelled | refunded
//   preparing → ready | cancelled
//   ready → served | cancelled
//   served → completed
//   completed → (terminal)
//   cancelled → refunded
//   refunded → (terminal)

import 'server-only'
import type { createSupabaseServerClientAdmin } from '@/lib/supabase/server'

type SupabaseAdminClient = Awaited<ReturnType<typeof createSupabaseServerClientAdmin>>

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'completed'
  | 'cancelled'
  | 'refunded'

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled', 'refunded'],
  preparing: ['ready', 'cancelled'],
  ready: ['served', 'cancelled'],
  served: ['completed'],
  completed: [],
  cancelled: ['refunded'],
  refunded: [],
}

export function canTransitionOrderStatus(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true // no-op is fine
  return TRANSITIONS[from]?.includes(to) ?? false
}

export class OrderStatusTransitionError extends Error {
  constructor(
    public from: OrderStatus,
    public to: OrderStatus,
  ) {
    super(`Illegal order status transition: ${from} → ${to}`)
    this.name = 'OrderStatusTransitionError'
  }
}

export function assertOrderStatusTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransitionOrderStatus(from, to)) {
    throw new OrderStatusTransitionError(from, to)
  }
}

// ── D3.2 — the DB-write half ─────────────────────────────────────────────────
//
// Mirrors lib/booking/transitionBookingStatus.ts's shape: `.eq('status', from)`
// IS the monotonic guard — if the row already moved on (concurrent request,
// stale client), the UPDATE matches zero rows and `ok:false, reason:'stale_state'`
// comes back, no error, safe to treat as "someone else already did this."
//
// This does NOT check `canTransitionOrderStatus` itself — the caller (the
// D3.2 advance route) has its own order-type-aware `legalNextStatuses` guard
// (ready branches to 'completed' for takeaway vs 'served' for qr, and this
// endpoint never allows cancel/refund), so re-checking the general graph
// here would just be redundant, not additive.

export type TransitionedOrder = {
  id: string
  status: OrderStatus
  updated_at: string
  ready_notified_at: string | null
}

export type TransitionOrderStatusParams = {
  orderId: string
  restaurantId: string
  from: OrderStatus
  to: OrderStatus
  /** Extra columns written in the same UPDATE — atomic with the status change. */
  extraSet?: Record<string, unknown>
}

export type TransitionOrderStatusResult =
  | { ok: true; row: TransitionedOrder }
  | { ok: false; reason: 'stale_state' | 'not_found' | 'db_error'; message?: string }

export async function transitionOrderStatus(
  admin: SupabaseAdminClient,
  params: TransitionOrderStatusParams,
): Promise<TransitionOrderStatusResult> {
  const { data, error } = await admin
    .from('orders')
    .update({ status: params.to, ...params.extraSet })
    .eq('id', params.orderId)
    .eq('restaurant_id', params.restaurantId)
    .eq('status', params.from)
    .select('id, status, updated_at, ready_notified_at')
    .maybeSingle()

  if (error) {
    return { ok: false, reason: 'db_error', message: error.message }
  }
  if (!data) {
    return { ok: false, reason: 'stale_state' }
  }
  return { ok: true, row: data as TransitionedOrder }
}
