import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'

/**
 * The restaurant's guest book (PRD §4.5). Hard privacy rules, enforced here:
 *
 *  - A guest exists for a restaurant only if they have ≥1 booking or order AT
 *    THIS restaurant. Every count, date and amount is computed from THIS
 *    restaurant's rows only (`guests` is a global table — never show
 *    cross-restaurant history).
 *  - Anonymised guests (anonymised_at set) never appear in list/search/detail.
 *  - VIP is per restaurant (guest_notes.is_vip). guests.loyalty_tier is global
 *    and is never read or written here.
 *
 * Reads use the service-role client AFTER the caller passed the permission +
 * tier gate; every query filters by restaurant_id.
 */

type Admin = SupabaseClient

export const GUEST_PAGE_SIZE = 50
const PAGE = 1000

export type GuestAggregate = {
  visits: number
  lastVisit: string | null
  lastInteraction: string
  spendCents: number
}

type BookingLite = {
  guest_id: string
  slot_time: string
  status: string
  deposit_intent_id: string | null
}
type OrderLite = {
  guest_id: string | null
  created_at: string
  status: string
  payment_status: string
  total_cents: number
  tab_id: string | null
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

/** A booking counts as a visit once its slot has passed and it wasn't cancelled / a no-show. */
function isVisitBooking(b: { slot_time: string; status: string }, now: number): boolean {
  if (b.status === 'attended') return true
  return (b.status === 'confirmed' || b.status === 'pending') && new Date(b.slot_time).getTime() <= now
}

const ORDER_DEAD = new Set(['cancelled', 'refunded'])

/**
 * Spend definition (shown in the UI next to the number):
 *   paid orders       — payment_status 'paid' (QR pay-now, takeaway), not cancelled/refunded
 *   paid at the table — orders on a tab settled 'paid_at_table'
 *   deposits kept     — deposit paid and not refunded, booking finished (attended / no-show / cancelled)
 */
function orderSpend(o: Pick<OrderLite, 'status' | 'payment_status' | 'total_cents' | 'tab_id'>, settledTabs: Set<string>): number {
  if (ORDER_DEAD.has(o.status)) return 0
  if (o.payment_status === 'paid') return o.total_cents
  if (o.tab_id && settledTabs.has(o.tab_id)) return o.total_cents
  return 0
}

type DepositIntent = { id: string; status: string; amount_cents: number; refunded_amount_cents: number }

function depositKept(b: Pick<BookingLite, 'status' | 'deposit_intent_id'>, intents: Map<string, DepositIntent>): number {
  if (!b.deposit_intent_id) return 0
  if (b.status === 'pending' || b.status === 'confirmed') return 0
  const i = intents.get(b.deposit_intent_id)
  if (!i || (i.status !== 'paid' && i.status !== 'partially_refunded')) return 0
  return Math.max(0, i.amount_cents - (i.refunded_amount_cents ?? 0))
}

/** Per-guest aggregates over this restaurant's bookings + orders. */
export async function computeGuestAggregates(admin: Admin, restaurantId: string): Promise<Map<string, GuestAggregate>> {
  const [bookings, orders, tabs, intents] = await Promise.all([
    fetchAll<BookingLite>((f, t) =>
      admin.from('bookings').select('guest_id, slot_time, status, deposit_intent_id').eq('restaurant_id', restaurantId).range(f, t),
    ),
    fetchAll<OrderLite>((f, t) =>
      admin
        .from('orders')
        .select('guest_id, created_at, status, payment_status, total_cents, tab_id')
        .eq('restaurant_id', restaurantId)
        .not('guest_id', 'is', null)
        .range(f, t),
    ),
    fetchAll<{ id: string }>((f, t) =>
      admin.from('tabs').select('id').eq('restaurant_id', restaurantId).eq('settlement', 'paid_at_table').range(f, t),
    ),
    fetchAll<DepositIntent>((f, t) =>
      admin
        .from('payment_intents')
        .select('id, status, amount_cents, refunded_amount_cents')
        .eq('restaurant_id', restaurantId)
        .eq('purpose', 'deposit')
        .range(f, t),
    ),
  ])
  const settledTabs = new Set(tabs.map((t) => t.id))
  const intentById = new Map(intents.map((i) => [i.id, i]))
  const now = Date.now()
  const agg = new Map<string, GuestAggregate>()
  const touch = (guestId: string) => {
    let a = agg.get(guestId)
    if (!a) {
      a = { visits: 0, lastVisit: null, lastInteraction: '', spendCents: 0 }
      agg.set(guestId, a)
    }
    return a
  }
  const later = (a: string | null, b: string) => (!a || b > a ? b : a)

  for (const b of bookings) {
    const a = touch(b.guest_id)
    a.lastInteraction = later(a.lastInteraction || null, b.slot_time) as string
    if (isVisitBooking(b, now)) {
      a.visits += 1
      a.lastVisit = later(a.lastVisit, b.slot_time)
    }
    a.spendCents += depositKept(b, intentById)
  }
  for (const o of orders) {
    if (!o.guest_id) continue
    const a = touch(o.guest_id)
    a.lastInteraction = later(a.lastInteraction || null, o.created_at) as string
    if (!ORDER_DEAD.has(o.status)) {
      a.visits += 1
      a.lastVisit = later(a.lastVisit, o.created_at)
    }
    a.spendCents += orderSpend(o, settledTabs)
  }
  return agg
}

export type GuestRow = {
  id: string
  name: string
  email: string | null
  phone: string | null
  marketingConsent: boolean
  marketingConsentAt: string | null
  visits: number
  lastVisit: string | null
  spendCents: number
  vip: boolean
}

type GuestDbRow = {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  marketing_consent: boolean
  marketing_consent_at: string | null
}

/** Characters with meaning in a PostgREST `or=(…)` filter or an ILIKE pattern. */
function sanitiseSearch(q: string): string {
  return q.replace(/[,()%_\\*"]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
}

async function loadGuestsById(admin: Admin, restaurantId: string, ids: string[], search: string): Promise<GuestDbRow[]> {
  const q = sanitiseSearch(search)
  const digits = q.replace(/\D/g, '')
  const out: GuestDbRow[] = []
  for (let i = 0; i < ids.length; i += 150) {
    let query = admin
      .from('guests')
      .select('id, full_name, email, phone, marketing_consent, marketing_consent_at')
      .in('id', ids.slice(i, i + 150))
      .is('anonymised_at', null)
    if (q) {
      // Values are double-quoted so spaces survive the or=(…) syntax; the
      // sanitiser already stripped quotes, commas, parentheses and wildcards.
      const ors = [`full_name.ilike."*${q}*"`, `email_lower.ilike."*${q.toLowerCase()}*"`, `phone.ilike."*${q}*"`]
      if (digits.length >= 3 && digits !== q) ors.push(`phone.ilike."*${digits}*"`)
      query = query.or(ors.join(','))
    }
    const { data, error } = await query
    if (error) throw error
    out.push(...((data ?? []) as GuestDbRow[]))
  }
  void restaurantId
  return out
}

async function loadVipSet(admin: Admin, restaurantId: string, ids: string[]): Promise<Set<string>> {
  const vip = new Set<string>()
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await admin
      .from('guest_notes')
      .select('guest_id')
      .eq('restaurant_id', restaurantId)
      .eq('is_vip', true)
      .in('guest_id', ids.slice(i, i + 150))
    for (const r of data ?? []) vip.add(r.guest_id as string)
  }
  return vip
}

/** All of this restaurant's (non-anonymised, optionally searched) guests, most recent visit first. */
export async function listAllGuests(restaurantId: string, search = ''): Promise<GuestRow[]> {
  const admin = await createSupabaseServerClientAdmin()
  const agg = await computeGuestAggregates(admin, restaurantId)
  const ids = [...agg.keys()]
  if (ids.length === 0) return []
  const [guests, vip] = await Promise.all([loadGuestsById(admin, restaurantId, ids, search), loadVipSet(admin, restaurantId, ids)])

  const rows = guests.map((g): GuestRow => {
    const a = agg.get(g.id) as GuestAggregate
    return {
      id: g.id,
      name: g.full_name ?? '',
      email: g.email,
      phone: g.phone,
      marketingConsent: g.marketing_consent,
      marketingConsentAt: g.marketing_consent_at,
      visits: a.visits,
      lastVisit: a.lastVisit,
      spendCents: a.spendCents,
      vip: vip.has(g.id),
    }
  })
  rows.sort((x, y) => {
    const ax = x.lastVisit ?? agg.get(x.id)?.lastInteraction ?? ''
    const ay = y.lastVisit ?? agg.get(y.id)?.lastInteraction ?? ''
    return ay.localeCompare(ax) || x.name.localeCompare(y.name)
  })
  return rows
}

export type GuestListPage = { rows: GuestRow[]; total: number; page: number; pageSize: number }

export async function listGuests(restaurantId: string, opts: { search?: string; page?: number }): Promise<GuestListPage> {
  const all = await listAllGuests(restaurantId, opts.search ?? '')
  const pages = Math.max(1, Math.ceil(all.length / GUEST_PAGE_SIZE))
  const page = Math.min(Math.max(1, opts.page ?? 1), pages)
  const from = (page - 1) * GUEST_PAGE_SIZE
  return { rows: all.slice(from, from + GUEST_PAGE_SIZE), total: all.length, page, pageSize: GUEST_PAGE_SIZE }
}

// ── Detail ──────────────────────────────────────────────────────────────────

export type GuestHistoryItem =
  | { kind: 'booking'; id: string; date: string; ref: string; status: string; partySize: number; depositKeptCents: number }
  | { kind: 'order'; id: string; date: string; ref: string; status: string; orderType: 'qr' | 'takeaway'; totalCents: number; paid: boolean }

export type GuestDetail = {
  id: string
  name: string
  email: string | null
  phone: string | null
  marketingConsent: boolean
  marketingConsentAt: string | null
  customerSince: string
  visits: number
  lastVisit: string | null
  spend: { totalCents: number; ordersCents: number; depositsCents: number }
  note: string | null
  noteUpdatedAt: string | null
  vip: boolean
  history: GuestHistoryItem[]
}

/** Null when the guest has no interaction with this restaurant, doesn't exist, or is anonymised. */
export async function getGuestDetail(restaurantId: string, guestId: string): Promise<GuestDetail | null> {
  const admin = await createSupabaseServerClientAdmin()
  const [{ data: bookings }, { data: orders }] = await Promise.all([
    admin
      .from('bookings')
      .select('id, booking_ref, slot_time, party_size, status, deposit_intent_id, created_at')
      .eq('restaurant_id', restaurantId)
      .eq('guest_id', guestId),
    admin
      .from('orders')
      .select('id, order_ref, order_type, status, payment_status, total_cents, tab_id, created_at')
      .eq('restaurant_id', restaurantId)
      .eq('guest_id', guestId),
  ])
  const b = bookings ?? []
  const o = orders ?? []
  if (b.length === 0 && o.length === 0) return null

  const { data: guest } = await admin
    .from('guests')
    .select('id, full_name, email, phone, marketing_consent, marketing_consent_at, anonymised_at')
    .eq('id', guestId)
    .maybeSingle()
  if (!guest || guest.anonymised_at) return null

  const tabIds = [...new Set(o.map((x) => x.tab_id).filter((x): x is string => Boolean(x)))]
  const intentIds = [...new Set(b.map((x) => x.deposit_intent_id).filter((x): x is string => Boolean(x)))]
  const [{ data: tabs }, { data: intents }, { data: note }] = await Promise.all([
    tabIds.length
      ? admin.from('tabs').select('id').eq('restaurant_id', restaurantId).eq('settlement', 'paid_at_table').in('id', tabIds)
      : Promise.resolve({ data: [] as { id: string }[] }),
    intentIds.length
      ? admin
          .from('payment_intents')
          .select('id, status, amount_cents, refunded_amount_cents')
          .eq('restaurant_id', restaurantId)
          .in('id', intentIds)
      : Promise.resolve({ data: [] as DepositIntent[] }),
    admin
      .from('guest_notes')
      .select('note, is_vip, updated_at')
      .eq('restaurant_id', restaurantId)
      .eq('guest_id', guestId)
      .maybeSingle(),
  ])
  const settledTabs = new Set((tabs ?? []).map((t) => t.id as string))
  const intentById = new Map(((intents ?? []) as DepositIntent[]).map((i) => [i.id, i]))
  const now = Date.now()

  let ordersCents = 0
  let depositsCents = 0
  let visits = 0
  let lastVisit: string | null = null
  const history: GuestHistoryItem[] = []

  for (const x of b) {
    const kept = depositKept(x, intentById)
    depositsCents += kept
    if (isVisitBooking(x, now)) {
      visits += 1
      if (!lastVisit || x.slot_time > lastVisit) lastVisit = x.slot_time
    }
    history.push({ kind: 'booking', id: x.id, date: x.slot_time, ref: x.booking_ref, status: x.status, partySize: x.party_size, depositKeptCents: kept })
  }
  for (const x of o) {
    const spend = orderSpend(x, settledTabs)
    ordersCents += spend
    if (!ORDER_DEAD.has(x.status)) {
      visits += 1
      if (!lastVisit || x.created_at > lastVisit) lastVisit = x.created_at
    }
    history.push({ kind: 'order', id: x.id, date: x.created_at, ref: x.order_ref, status: x.status, orderType: x.order_type, totalCents: x.total_cents, paid: spend > 0 })
  }
  history.sort((p, q) => q.date.localeCompare(p.date))

  const firstSeen = [...b.map((x) => x.created_at), ...o.map((x) => x.created_at)].sort()[0]

  return {
    id: guest.id,
    name: guest.full_name ?? '',
    email: guest.email,
    phone: guest.phone,
    marketingConsent: guest.marketing_consent,
    marketingConsentAt: guest.marketing_consent_at,
    customerSince: firstSeen,
    visits,
    lastVisit,
    spend: { totalCents: ordersCents + depositsCents, ordersCents, depositsCents },
    note: note?.note ?? null,
    noteUpdatedAt: note?.updated_at ?? null,
    vip: note?.is_vip ?? false,
    history,
  }
}

/** True when the guest has ≥1 booking or order at this restaurant and isn't anonymised. */
export async function guestBelongsToRestaurant(restaurantId: string, guestId: string): Promise<boolean> {
  const admin = await createSupabaseServerClientAdmin()
  const [{ count: bc }, { count: oc }, { data: guest }] = await Promise.all([
    admin.from('bookings').select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurantId).eq('guest_id', guestId),
    admin.from('orders').select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurantId).eq('guest_id', guestId),
    admin.from('guests').select('anonymised_at').eq('id', guestId).maybeSingle(),
  ])
  return ((bc ?? 0) > 0 || (oc ?? 0) > 0) && Boolean(guest) && !guest?.anonymised_at
}
