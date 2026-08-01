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

/**
 * The single inline next-action stub per (status, order_type) — key suffix
 * under `dashboard.orders.action.*`. Null when there's no next action to show
 * (served orders, or any terminal status). D3.2 wires these up for real;
 * D3.1 renders them disabled with a "Beschikbaar in D3.2" tooltip.
 */
export function nextActionKey(status: OrderStatus, orderType: 'qr' | 'takeaway'): string | null {
  switch (status) {
    case 'pending':
      return 'accept'
    case 'confirmed':
      return 'startPreparing'
    case 'preparing':
      return 'markReady'
    case 'ready':
      return orderType === 'takeaway' ? 'markPickedUp' : 'markServed'
    default:
      return null
  }
}
