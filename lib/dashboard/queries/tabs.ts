import 'server-only'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { OrderStatus } from '@/lib/orders/transitionOrderStatus'

/**
 * Tab query helpers (D3.4). Session client throughout — RLS scopes every
 * read to the caller's own restaurant; `restaurant_id` filters are
 * belt-and-braces on top of that, never the only guard.
 *
 * `status` is the live enum ('open' | 'settled' | 'cancelled') confirmed
 * against the D3.4 preflight — NOT 'open'/'closed'. Only 'open' matters for
 * these list queries; the two closed states are D3.4's own close route's
 * concern.
 */

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000

export type OpenTab = {
  id: string
  opened_at: string
  total_cents: number
  table_id: string
  table_label: string | null
  order_count: number
  guest_count: number
}

export type TabsPayload = {
  tabs: OpenTab[]
  totals: {
    open_count: number
    outstanding_cents: number
    stale_count: number
  }
  now_iso: string
}

export type TabOrderItemDetail = {
  id: string
  order_id: string
  quantity: number
  unit_price_cents: number
  line_total_cents: number
  item_notes: string | null
  name_snapshot: string
}

export type TabOrderDetail = {
  id: string
  order_ref: string
  order_type: 'qr' | 'takeaway'
  status: OrderStatus
  payment_status: string
  total_cents: number
  subtotal_cents: number
  vat_cents: number
  created_at: string
  guest_note: string | null
  guest_name: string | null
  items: TabOrderItemDetail[]
}

export type TabDetailPayload = {
  tab: {
    id: string
    status: string
    opened_at: string
    closed_at: string | null
    total_cents: number
    table_id: string
    table_label: string | null
    settlement: 'paid_at_table' | 'written_off' | null
    write_off_reason: string | null
    closed_by_display_name: string | null
  }
  orders: TabOrderDetail[]
}

type OpenTabRow = {
  id: string
  opened_at: string
  total_cents: number
  table_id: string
  table: { label: string | null } | null
  orders: { id: string; guest_id: string | null }[] | null
}

/** Every tab currently `status = 'open'`, oldest first (staff attention priority). */
export async function getOpenTabsWithOrders(restaurantId: string): Promise<OpenTab[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('tabs')
    .select(
      `id, opened_at, total_cents, table_id,
       table:restaurant_tables(label),
       orders(id, guest_id)`,
    )
    .eq('restaurant_id', restaurantId)
    .eq('status', 'open')
    .order('opened_at', { ascending: true })
  if (error) throw error

  return ((data ?? []) as unknown as OpenTabRow[]).map((row) => {
    const orders = row.orders ?? []
    const guestIds = new Set(orders.map((o) => o.guest_id).filter((id): id is string => Boolean(id)))
    return {
      id: row.id,
      opened_at: row.opened_at,
      total_cents: row.total_cents,
      table_id: row.table_id,
      table_label: row.table?.label ?? null,
      order_count: orders.length,
      guest_count: guestIds.size,
    }
  })
}

/** One tab, scoped to `restaurantId` explicitly, plus its orders + items. Returns closed tabs too — the URL might be used to inspect one. */
export async function getTabById(restaurantId: string, tabId: string): Promise<TabDetailPayload | null> {
  const supabase = await createSupabaseServerClient()

  const { data: tabRow, error: tabError } = await supabase
    .from('tabs')
    .select(
      `id, status, opened_at, closed_at, total_cents, table_id, settlement, write_off_reason,
       table:restaurant_tables(label),
       closed_by_staff:restaurant_staff!closed_by(display_name)`,
    )
    .eq('id', tabId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle()

  if (tabError) throw tabError
  if (!tabRow) return null

  type RawTabRow = {
    id: string
    status: string
    opened_at: string
    closed_at: string | null
    total_cents: number
    table_id: string
    settlement: 'paid_at_table' | 'written_off' | null
    write_off_reason: string | null
    table: { label: string | null } | null
    closed_by_staff: { display_name: string | null } | null
  }
  const row = tabRow as unknown as RawTabRow

  const { data: orderRows, error: ordersError } = await supabase
    .from('orders')
    .select(
      `id, order_ref, order_type, status, payment_status, total_cents, subtotal_cents, vat_cents,
       created_at, guest_note,
       guest:guests(full_name)`,
    )
    .eq('tab_id', tabId)
    .order('created_at', { ascending: true })
  if (ordersError) throw ordersError

  type RawOrderRow = {
    id: string
    order_ref: string
    order_type: 'qr' | 'takeaway'
    status: OrderStatus
    payment_status: string
    total_cents: number
    subtotal_cents: number
    vat_cents: number
    created_at: string
    guest_note: string | null
    guest: { full_name: string | null } | null
  }
  const orders = (orderRows ?? []) as unknown as RawOrderRow[]
  const orderIds = orders.map((o) => o.id)

  const itemsByOrderId = new Map<string, TabOrderItemDetail[]>()
  if (orderIds.length > 0) {
    const { data: itemRows, error: itemsError } = await supabase
      .from('order_items')
      .select('id, order_id, quantity, unit_price_cents, line_total_cents, item_notes, name_snapshot')
      .in('order_id', orderIds)
      .order('created_at', { ascending: true })
    if (itemsError) throw itemsError
    for (const item of itemRows ?? []) {
      const list = itemsByOrderId.get(item.order_id) ?? []
      list.push(item as TabOrderItemDetail)
      itemsByOrderId.set(item.order_id, list)
    }
  }

  return {
    tab: {
      id: row.id,
      status: row.status,
      opened_at: row.opened_at,
      closed_at: row.closed_at,
      total_cents: row.total_cents,
      table_id: row.table_id,
      table_label: row.table?.label ?? null,
      settlement: row.settlement,
      write_off_reason: row.write_off_reason,
      closed_by_display_name: row.closed_by_staff?.display_name ?? null,
    },
    orders: orders.map((o) => ({
      id: o.id,
      order_ref: o.order_ref,
      order_type: o.order_type,
      status: o.status,
      payment_status: o.payment_status,
      total_cents: o.total_cents,
      subtotal_cents: o.subtotal_cents,
      vat_cents: o.vat_cents,
      created_at: o.created_at,
      guest_note: o.guest_note,
      guest_name: o.guest?.full_name ?? null,
      items: itemsByOrderId.get(o.id) ?? [],
    })),
  }
}

/** Composed payload for the initial page render and every poll. */
export async function getTabsPayload(restaurantId: string, now: Date = new Date()): Promise<TabsPayload> {
  const tabs = await getOpenTabsWithOrders(restaurantId)
  const cutoff = now.getTime() - FOUR_HOURS_MS
  const stale_count = tabs.filter((t) => new Date(t.opened_at).getTime() < cutoff).length
  const outstanding_cents = tabs.reduce((sum, t) => sum + t.total_cents, 0)

  return {
    tabs,
    totals: {
      open_count: tabs.length,
      outstanding_cents,
      stale_count,
    },
    now_iso: now.toISOString(),
  }
}
