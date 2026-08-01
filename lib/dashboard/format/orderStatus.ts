import type { OrderStatus } from '@/lib/orders/transitionOrderStatus'
import type { StatusTone } from '@/components/dashboard/ui/StatusChip'

/**
 * Pure order_status → { tone, isActive } mapping shared by the queries layer
 * (active/terminal split) and the client status chip. Translation goes
 * through next-intl (`t('status.' + status)`) at render time, matching every
 * other status chip in the dashboard (see BookingRow.tsx) rather than baking
 * bilingual strings into this file.
 */

export type OrderStatusMapping = {
  tone: StatusTone
  isActive: boolean
}

const MAPPING: Record<OrderStatus, OrderStatusMapping> = {
  pending: { tone: 'warning', isActive: true },
  confirmed: { tone: 'warning', isActive: true },
  preparing: { tone: 'warning', isActive: true },
  ready: { tone: 'success', isActive: true },
  // Served orders stay in the active queue until staff completes them —
  // `served → completed` is the only transition out (transitionOrderStatus.ts).
  served: { tone: 'success', isActive: true },
  completed: { tone: 'neutral', isActive: false },
  cancelled: { tone: 'neutral', isActive: false },
  refunded: { tone: 'neutral', isActive: false },
}

export function getOrderStatusMapping(status: OrderStatus): OrderStatusMapping {
  return MAPPING[status]
}

export const ACTIVE_ORDER_STATUSES = (Object.keys(MAPPING) as OrderStatus[]).filter(
  (s) => MAPPING[s].isActive,
)

export const TERMINAL_ORDER_STATUSES = (Object.keys(MAPPING) as OrderStatus[]).filter(
  (s) => !MAPPING[s].isActive,
)

export type OrderNextAction = {
  /** Key suffix under `dashboard.orders.action.*`. */
  key: string
  /** The status this action's button advances to — passed straight to `useOrderActions().advance()`. */
  to: OrderStatus
}

/**
 * The single inline next-action per (status, order_type) — same shape the
 * D3.2 advance route's own `legalNextStatuses` enforces server-side; this is
 * UX help only; the server is the real authority. Null when there's no next
 * action to show (served orders, or any terminal status).
 */
export function nextAction(status: OrderStatus, orderType: 'qr' | 'takeaway'): OrderNextAction | null {
  switch (status) {
    case 'pending':
      return { key: 'accept', to: 'confirmed' }
    case 'confirmed':
      return { key: 'startPreparing', to: 'preparing' }
    case 'preparing':
      return { key: 'markReady', to: 'ready' }
    case 'ready':
      return orderType === 'takeaway' ? { key: 'markPickedUp', to: 'completed' } : { key: 'markServed', to: 'served' }
    default:
      return null
  }
}
