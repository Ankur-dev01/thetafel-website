import 'server-only'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { amsterdamDayBoundsUtc, amsterdamCivilDate } from '@/lib/dashboard/date/amsterdamDay'
import { ACTIVE_ORDER_STATUSES, TERMINAL_ORDER_STATUSES } from '@/lib/dashboard/format/orderStatus'
import type { OrderStatus } from '@/lib/orders/transitionOrderStatus'

/**
 * Order-queue query helpers (D3.1). Session client throughout — RLS scopes
 * every read to the caller's own restaurant; `restaurant_id` filters are
 * belt-and-braces on top of that, never the only guard.
 */

export type OrderListRow = {
  id: string
  order_ref: string
  order_type: 'qr' | 'takeaway'
  status: OrderStatus
  payment_status: string
  total_cents: number
  subtotal_cents: number
  vat_cents: number
  created_at: string
  pickup_time: string | null
  table_id: string | null
  tab_id: string | null
  guest_id: string | null
  table_label: string | null
  guest_name: string | null
  item_count: number
}

export type ActiveOrder = OrderListRow
export type CompletedOrder = OrderListRow

export type OrderItemDetail = {
  id: string
  quantity: number
  unit_price_cents: number
  line_total_cents: number
  item_notes: string | null
  modifiers: unknown
  name_snapshot: string
}

export type OrderDetailPayload = {
  order: OrderListRow & { guest_phone: string | null; guest_note: string | null }
  items: OrderItemDetail[]
}

export type OrdersPayload = {
  active: ActiveOrder[]
  completedToday: CompletedOrder[]
  now_iso: string
  server_max_created_at: string | null
}

type OrderListJoinRow = {
  id: string
  order_ref: string
  order_type: 'qr' | 'takeaway'
  status: OrderStatus
  payment_status: string
  total_cents: number
  subtotal_cents: number
  vat_cents: number
  created_at: string
  pickup_time: string | null
  table_id: string | null
  tab_id: string | null
  guest_id: string | null
  table: { label: string | null } | null
  guest: { full_name: string | null } | null
  order_items: { count: number }[] | null
}

const ORDER_LIST_SELECT = `id, order_ref, order_type, status, payment_status, total_cents, subtotal_cents, vat_cents,
       created_at, pickup_time, table_id, tab_id, guest_id,
       table:restaurant_tables(label),
       guest:guests(full_name),
       order_items(count)`

function toOrderListRow(row: OrderListJoinRow): OrderListRow {
  return {
    id: row.id,
    order_ref: row.order_ref,
    order_type: row.order_type,
    status: row.status,
    payment_status: row.payment_status,
    total_cents: row.total_cents,
    subtotal_cents: row.subtotal_cents,
    vat_cents: row.vat_cents,
    created_at: row.created_at,
    pickup_time: row.pickup_time,
    table_id: row.table_id,
    tab_id: row.tab_id,
    guest_id: row.guest_id,
    table_label: row.table?.label ?? null,
    guest_name: row.guest?.full_name ?? null,
    item_count: row.order_items?.[0]?.count ?? 0,
  }
}

/** Every order not yet in a terminal state, oldest first (FIFO — kitchen works top-down). */
export async function getActiveOrders(restaurantId: string): Promise<ActiveOrder[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_LIST_SELECT)
    .eq('restaurant_id', restaurantId)
    .in('status', ACTIVE_ORDER_STATUSES)
    .order('created_at', { ascending: true })
  if (error) throw error
  return ((data ?? []) as unknown as OrderListJoinRow[]).map(toOrderListRow)
}

/** Terminal-status orders created today (Amsterdam civil day), most recent first. */
export async function getCompletedOrdersToday(restaurantId: string, now: Date): Promise<CompletedOrder[]> {
  const supabase = await createSupabaseServerClient()
  const { startUtc, endUtc } = amsterdamDayBoundsUtc(amsterdamCivilDate(now))

  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_LIST_SELECT)
    .eq('restaurant_id', restaurantId)
    .in('status', TERMINAL_ORDER_STATUSES)
    .gte('created_at', startUtc)
    .lt('created_at', endUtc)
    .order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as unknown as OrderListJoinRow[]).map(toOrderListRow)
}

/** One order, scoped to `restaurantId` explicitly (RLS is the belt, this is the braces), plus its item lines. */
export async function getOrderById(restaurantId: string, orderId: string): Promise<OrderDetailPayload | null> {
  const supabase = await createSupabaseServerClient()

  const { data: orderRow, error: orderError } = await supabase
    .from('orders')
    .select(
      `id, order_ref, order_type, status, payment_status, total_cents, subtotal_cents, vat_cents,
       created_at, pickup_time, table_id, tab_id, guest_id, guest_note,
       table:restaurant_tables(label),
       guest:guests(full_name, phone),
       order_items(count)`,
    )
    .eq('restaurant_id', restaurantId)
    .eq('id', orderId)
    .maybeSingle()

  if (orderError) throw orderError
  if (!orderRow) return null

  type RawRow = OrderListJoinRow & { guest_note: string | null; guest: { full_name: string | null; phone: string | null } | null }
  const row = orderRow as unknown as RawRow

  const { data: itemRows, error: itemsError } = await supabase
    .from('order_items')
    .select('id, quantity, unit_price_cents, line_total_cents, item_notes, modifiers, name_snapshot')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })
  if (itemsError) throw itemsError

  const items: OrderItemDetail[] = (itemRows ?? []).map((r) => ({
    id: r.id,
    quantity: r.quantity,
    unit_price_cents: r.unit_price_cents,
    line_total_cents: r.line_total_cents,
    item_notes: r.item_notes,
    modifiers: r.modifiers,
    name_snapshot: r.name_snapshot,
  }))

  return {
    order: {
      ...toOrderListRow(row),
      guest_phone: row.guest?.phone ?? null,
      guest_note: row.guest_note,
    },
    items,
  }
}

/** Composed payload for the initial page render and every poll. */
export async function getOrdersPayload(restaurantId: string, now: Date = new Date()): Promise<OrdersPayload> {
  const [active, completedToday] = await Promise.all([
    getActiveOrders(restaurantId),
    getCompletedOrdersToday(restaurantId, now),
  ])

  const allCreatedAt = [...active, ...completedToday].map((o) => o.created_at)
  const server_max_created_at =
    allCreatedAt.length > 0 ? allCreatedAt.reduce((max, iso) => (iso > max ? iso : max)) : null

  return {
    active,
    completedToday,
    now_iso: now.toISOString(),
    server_max_created_at,
  }
}
