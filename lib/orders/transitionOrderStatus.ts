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
