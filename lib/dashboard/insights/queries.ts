import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'
import { amsterdamCivilDate, amsterdamDayBoundsUtc } from '@/lib/dashboard/date/amsterdamDay'
import { ORDER_DEAD, depositKept, orderSpend, type DepositIntent } from '@/lib/dashboard/guests/guests'
import { addDays, daysBetween, type InsightBooking, type InsightOrder } from './compute'

/**
 * Insights data access. Everything is read live from this restaurant's own
 * rows (service-role client AFTER the permission + tier gate), scoped by
 * restaurant_id and the Amsterdam-day range. Nothing is cached or sampled.
 */

const MAX_RANGE_DAYS = 366
const PAGE = 1000

export type InsightRange = {
  from: string // civil day, inclusive
  to: string // civil day, inclusive
  days: number
  preset: '7' | '30' | '90' | 'custom'
}

const CIVIL = /^\d{4}-\d{2}-\d{2}$/
const validCivil = (s: string | undefined): s is string => {
  if (!s || !CIVIL.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d
}

/** `range` = 7 | 30 | 90 | custom (+ from/to). Default 30 days ending today; custom is capped at 366 days. */
export function parseRange(params: { range?: string; from?: string; to?: string }, now: Date = new Date()): InsightRange {
  const today = amsterdamCivilDate(now)
  if (params.range === 'custom' && validCivil(params.from) && validCivil(params.to)) {
    let from = params.from
    let to = params.to
    if (from > to) [from, to] = [to, from]
    if (daysBetween(from, to) + 1 > MAX_RANGE_DAYS) from = addDays(to, -(MAX_RANGE_DAYS - 1))
    return { from, to, days: daysBetween(from, to) + 1, preset: 'custom' }
  }
  const n = params.range === '7' ? 7 : params.range === '90' ? 90 : 30
  return { from: addDays(today, -(n - 1)), to: today, days: n, preset: String(n) as InsightRange['preset'] }
}

export function previousRange(r: InsightRange): { from: string; to: string } {
  return { from: addDays(r.from, -r.days), to: addDays(r.from, -1) }
}

async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) throw error
    out.push(...(data ?? []))
    if (!data || data.length < PAGE) return out
  }
}

type BookingRow = {
  party_size: number
  slot_time: string
  created_at: string
  status: InsightBooking['status']
  source: string
  deposit_intent_id: string | null
}

async function loadBookings(admin: SupabaseClient, restaurantId: string, from: string, to: string): Promise<InsightBooking[]> {
  const startUtc = amsterdamDayBoundsUtc(from).startUtc
  const endUtc = amsterdamDayBoundsUtc(to).endUtc
  const rows = await fetchAll<BookingRow>((f, t) =>
    admin
      .from('bookings')
      .select('party_size, slot_time, created_at, status, source, deposit_intent_id')
      .eq('restaurant_id', restaurantId)
      .gte('slot_time', startUtc)
      .lt('slot_time', endUtc)
      .order('slot_time', { ascending: true })
      .range(f, t),
  )
  const intentIds = [...new Set(rows.map((r) => r.deposit_intent_id).filter((x): x is string => Boolean(x)))]
  const intents = new Map<string, DepositIntent>()
  for (let i = 0; i < intentIds.length; i += 150) {
    const { data } = await admin
      .from('payment_intents')
      .select('id, status, amount_cents, refunded_amount_cents')
      .eq('restaurant_id', restaurantId)
      .in('id', intentIds.slice(i, i + 150))
    for (const x of (data ?? []) as DepositIntent[]) intents.set(x.id, x)
  }
  return rows.map((r) => ({
    party_size: r.party_size,
    slot_time: r.slot_time,
    created_at: r.created_at,
    status: r.status,
    source: r.source,
    deposit_kept_cents: depositKept(r, intents),
  }))
}

type OrderRow = {
  id: string
  order_type: 'qr' | 'takeaway'
  status: string
  payment_status: string
  created_at: string
  table_id: string | null
  tab_id: string | null
  total_cents: number
  vat_cents: number
  order_items: { menu_item_id: string | null; name_snapshot: string; quantity: number; line_total_cents: number }[] | null
}

async function loadOrders(admin: SupabaseClient, restaurantId: string, from: string, to: string): Promise<InsightOrder[]> {
  const startUtc = amsterdamDayBoundsUtc(from).startUtc
  const endUtc = amsterdamDayBoundsUtc(to).endUtc
  const rows = await fetchAll<OrderRow>((f, t) =>
    admin
      .from('orders')
      .select(
        'id, order_type, status, payment_status, created_at, table_id, tab_id, total_cents, vat_cents, order_items(menu_item_id, name_snapshot, quantity, line_total_cents)',
      )
      .eq('restaurant_id', restaurantId)
      .gte('created_at', startUtc)
      .lt('created_at', endUtc)
      .order('created_at', { ascending: true })
      .range(f, t),
  )
  const tabIds = [...new Set(rows.map((r) => r.tab_id).filter((x): x is string => Boolean(x)))]
  const settled = new Set<string>()
  for (let i = 0; i < tabIds.length; i += 150) {
    const { data } = await admin
      .from('tabs')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .eq('settlement', 'paid_at_table')
      .in('id', tabIds.slice(i, i + 150))
    for (const x of data ?? []) settled.add(x.id as string)
  }
  return rows.map((r) => ({
    order_type: r.order_type,
    status: r.status,
    created_at: r.created_at,
    table_id: r.table_id,
    total_cents: r.total_cents,
    vat_cents: r.vat_cents,
    spend_cents: ORDER_DEAD.has(r.status) ? 0 : orderSpend(r, settled),
    items: (r.order_items ?? []).map((i) => ({
      menu_item_id: i.menu_item_id,
      name_snapshot: i.name_snapshot,
      quantity: i.quantity,
      line_total_cents: i.line_total_cents,
    })),
  }))
}

export type InsightData = {
  range: InsightRange
  bookings: InsightBooking[]
  previousBookings: InsightBooking[]
  orders: InsightOrder[]
}

export async function loadInsightData(restaurantId: string, range: InsightRange): Promise<InsightData> {
  const admin = await createSupabaseServerClientAdmin()
  const prev = previousRange(range)
  const [bookings, previousBookings, orders] = await Promise.all([
    loadBookings(admin, restaurantId, range.from, range.to),
    loadBookings(admin, restaurantId, prev.from, prev.to),
    loadOrders(admin, restaurantId, range.from, range.to),
  ])
  return { range, bookings, previousBookings, orders }
}

export type RevenueDims = {
  tableLabel: Map<string, string>
  zoneOfTable: Map<string, string>
  categoryOfItem: Map<string, string>
  categoryLabel: Map<string, string>
}

/** Names for the Premium revenue splits (tables → zones, menu items → categories). */
export async function loadRevenueDims(restaurantId: string, locale: 'nl' | 'en'): Promise<RevenueDims> {
  const admin = await createSupabaseServerClientAdmin()
  const [{ data: tables }, { data: zones }, { data: items }, { data: cats }] = await Promise.all([
    admin.from('restaurant_tables').select('id, label, zone_id').eq('restaurant_id', restaurantId),
    admin.from('zones').select('id, name').eq('restaurant_id', restaurantId),
    admin.from('menu_items').select('id, category_id').eq('restaurant_id', restaurantId),
    admin.from('menu_categories').select('id, name_nl, name_en').eq('restaurant_id', restaurantId),
  ])
  const zoneName = new Map((zones ?? []).map((z) => [z.id as string, z.name as string]))
  return {
    tableLabel: new Map((tables ?? []).map((t) => [t.id as string, t.label as string])),
    zoneOfTable: new Map((tables ?? []).map((t) => [t.id as string, zoneName.get(t.zone_id as string) ?? '—'])),
    categoryOfItem: new Map((items ?? []).filter((i) => i.category_id).map((i) => [i.id as string, i.category_id as string])),
    categoryLabel: new Map((cats ?? []).map((c) => [c.id as string, ((locale === 'en' ? c.name_en : null) ?? c.name_nl) as string])),
  }
}
