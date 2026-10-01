/**
 * Insights computations (PRD §4.7) — PURE functions over this restaurant's own
 * rows. No I/O, no clock, no sampling and no invented numbers: callers fetch
 * rows scoped by restaurant_id + date range and pass them in. All day / hour /
 * weekday bucketing is Europe/Amsterdam.
 */

const TZ = 'Europe/Amsterdam'

export type InsightBooking = {
  party_size: number
  slot_time: string
  created_at: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'attended' | 'no_show'
  source: string
  /** Deposit actually kept (paid, not refunded, booking finished) — 0 otherwise. */
  deposit_kept_cents: number
}

export type InsightOrderItem = {
  menu_item_id: string | null
  name_snapshot: string
  quantity: number
  line_total_cents: number
}

export type InsightOrder = {
  order_type: 'qr' | 'takeaway'
  status: string
  created_at: string
  table_id: string | null
  total_cents: number
  vat_cents: number
  /** Money recognised for this order: total if paid (or settled at the table), else 0. */
  spend_cents: number
  items: InsightOrderItem[]
}

export const civilDay = (iso: string): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))

export function amsterdamHour(iso: string): number {
  const h = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(new Date(iso))
  return Number(h)
}

/** 0 = Sunday … 6 = Saturday for a civil date. */
export const weekdayOf = (day: string): number => new Date(`${day}T12:00:00Z`).getUTCDay()

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86_400_000)
}

/** Inclusive list of civil days from..to. */
export function dayRange(from: string, to: string): string[] {
  const out: string[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

// ── Occupancy ───────────────────────────────────────────────────────────────

export type OccupancyDay = { date: string; bookings: number; covers: number }

export type Occupancy = {
  days: OccupancyDay[]
  totalBookings: number
  totalCovers: number
  /** Weekday (0=Sun…6=Sat) with the highest average covers per occurrence; null without data. */
  busiestWeekday: number | null
}

/** Non-cancelled bookings (pending / confirmed / attended / no-show held a table). */
export function computeOccupancy(bookings: InsightBooking[], from: string, to: string): Occupancy {
  const byDay = new Map<string, OccupancyDay>(dayRange(from, to).map((d) => [d, { date: d, bookings: 0, covers: 0 }]))
  for (const b of bookings) {
    if (b.status === 'cancelled') continue
    const row = byDay.get(civilDay(b.slot_time))
    if (!row) continue
    row.bookings += 1
    row.covers += b.party_size
  }
  const days = [...byDay.values()]
  const coversByWeekday = new Array(7).fill(0)
  const occurrences = new Array(7).fill(0)
  for (const d of days) {
    const w = weekdayOf(d.date)
    coversByWeekday[w] += d.covers
    occurrences[w] += 1
  }
  let busiest: number | null = null
  let best = 0
  for (let w = 0; w < 7; w++) {
    const avg = occurrences[w] ? coversByWeekday[w] / occurrences[w] : 0
    if (avg > best) {
      best = avg
      busiest = w
    }
  }
  return {
    days,
    totalBookings: days.reduce((n, d) => n + d.bookings, 0),
    totalCovers: days.reduce((n, d) => n + d.covers, 0),
    busiestWeekday: busiest,
  }
}

// ── Booking patterns ────────────────────────────────────────────────────────

export const LEAD_BUCKETS = ['same_day', 'd1_2', 'd3_7', 'd8_30', 'd30_plus'] as const
export type LeadBucket = (typeof LEAD_BUCKETS)[number]

export function leadBucket(daysAhead: number): LeadBucket {
  if (daysAhead <= 0) return 'same_day'
  if (daysAhead <= 2) return 'd1_2'
  if (daysAhead <= 7) return 'd3_7'
  if (daysAhead <= 30) return 'd8_30'
  return 'd30_plus'
}

export const PARTY_BUCKETS = ['1', '2', '3', '4', '5', '6', '7_8', '9_plus'] as const
export type PartyBucket = (typeof PARTY_BUCKETS)[number]

export function partyBucket(size: number): PartyBucket {
  if (size <= 1) return '1'
  if (size <= 6) return String(size) as PartyBucket
  if (size <= 8) return '7_8'
  return '9_plus'
}

export type RateStat = { cancelled: number; cancellationRate: number | null; noShows: number; noShowRate: number | null; total: number }

/** Cancellation rate = cancelled / all bookings; no-show rate = no-shows / finished (attended + no-show). */
export function computeRates(bookings: InsightBooking[]): RateStat {
  const total = bookings.length
  const cancelled = bookings.filter((b) => b.status === 'cancelled').length
  const noShows = bookings.filter((b) => b.status === 'no_show').length
  const attended = bookings.filter((b) => b.status === 'attended').length
  return {
    total,
    cancelled,
    noShows,
    cancellationRate: total > 0 ? cancelled / total : null,
    noShowRate: attended + noShows > 0 ? noShows / (attended + noShows) : null,
  }
}

export type Patterns = {
  lead: Record<LeadBucket, number>
  leadTotal: number
  party: Record<PartyBucket, number>
  partyTotal: number
  current: RateStat
  /** Null unless the previous period has bookings (never divide by zero). */
  previous: RateStat | null
}

export function computePatterns(bookings: InsightBooking[], previousBookings: InsightBooking[]): Patterns {
  const lead = Object.fromEntries(LEAD_BUCKETS.map((b) => [b, 0])) as Record<LeadBucket, number>
  const party = Object.fromEntries(PARTY_BUCKETS.map((b) => [b, 0])) as Record<PartyBucket, number>
  let leadTotal = 0
  let partyTotal = 0
  for (const b of bookings) {
    if (b.status !== 'cancelled') {
      party[partyBucket(b.party_size)] += 1
      partyTotal += 1
    }
    // Walk-ins are booked on the spot — they'd drown the lead-time picture.
    if (b.source !== 'walk_in') {
      lead[leadBucket(daysBetween(civilDay(b.created_at), civilDay(b.slot_time)))] += 1
      leadTotal += 1
    }
  }
  return {
    lead,
    leadTotal,
    party,
    partyTotal,
    current: computeRates(bookings),
    previous: previousBookings.length > 0 ? computeRates(previousBookings) : null,
  }
}

// ── Orders ──────────────────────────────────────────────────────────────────

export type OrdersSummary = {
  qr: number
  takeaway: number
  total: number
  /** Average over PAID orders only; null when there are none. */
  averageOrderValueCents: number | null
  paidOrders: number
  hours: number[] // 24 buckets, orders created per Amsterdam hour
  busiestHour: number | null
}

const DEAD = new Set(['cancelled', 'refunded'])

export function computeOrders(orders: InsightOrder[]): OrdersSummary {
  const live = orders.filter((o) => !DEAD.has(o.status))
  const hours = new Array(24).fill(0)
  for (const o of live) hours[amsterdamHour(o.created_at)] += 1
  const paid = live.filter((o) => o.spend_cents > 0)
  let busiest: number | null = null
  let best = 0
  hours.forEach((n, h) => {
    if (n > best) {
      best = n
      busiest = h
    }
  })
  return {
    qr: live.filter((o) => o.order_type === 'qr').length,
    takeaway: live.filter((o) => o.order_type === 'takeaway').length,
    total: live.length,
    averageOrderValueCents: paid.length ? Math.round(paid.reduce((s, o) => s + o.spend_cents, 0) / paid.length) : null,
    paidOrders: paid.length,
    hours,
    busiestHour: busiest,
  }
}

// ── Top dishes ──────────────────────────────────────────────────────────────

export type DishRow = { key: string; name: string; quantity: number }

export type TopDishes = { top: DishRow[]; bottom: DishRow[]; distinct: number }

export function computeTopDishes(orders: InsightOrder[]): TopDishes {
  const map = new Map<string, DishRow>()
  for (const o of orders) {
    if (DEAD.has(o.status)) continue
    for (const it of o.items) {
      const key = it.menu_item_id ?? `name:${it.name_snapshot}`
      const row = map.get(key) ?? { key, name: it.name_snapshot, quantity: 0 }
      row.quantity += it.quantity
      map.set(key, row)
    }
  }
  const sorted = [...map.values()].sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name))
  const top = sorted.slice(0, 10)
  // Bottom five come from what is NOT already in the top ten, so a short menu
  // never lists the same dish as both a bestseller and a laggard.
  const rest = sorted.slice(10)
  const bottom = rest.slice(-5).sort((a, b) => a.quantity - b.quantity || a.name.localeCompare(b.name))
  return { top, bottom, distinct: sorted.length }
}

// ── Revenue (Premium) ───────────────────────────────────────────────────────

export type RevenueDay = {
  date: string
  /** Paid orders, VAT-inclusive. */
  ordersGrossCents: number
  /** VAT on those orders, from orders.vat_cents (stored at order time — no rate guessing). */
  ordersVatCents: number
  /** Deposits kept (no VAT split is stored for deposits). */
  depositsCents: number
}

export type Revenue = {
  days: RevenueDay[]
  ordersGrossCents: number
  ordersVatCents: number
  ordersNetCents: number
  depositsCents: number
  /** Orders + deposits, incl. VAT where VAT applies. */
  totalInclCents: number
}

export function computeRevenue(orders: InsightOrder[], bookings: InsightBooking[], from: string, to: string): Revenue {
  const byDay = new Map<string, RevenueDay>(
    dayRange(from, to).map((d) => [d, { date: d, ordersGrossCents: 0, ordersVatCents: 0, depositsCents: 0 }]),
  )
  for (const o of orders) {
    if (o.spend_cents <= 0) continue
    const row = byDay.get(civilDay(o.created_at))
    if (!row) continue
    row.ordersGrossCents += o.spend_cents
    row.ordersVatCents += o.vat_cents
  }
  for (const b of bookings) {
    if (b.deposit_kept_cents <= 0) continue
    const row = byDay.get(civilDay(b.slot_time))
    if (row) row.depositsCents += b.deposit_kept_cents
  }
  const days = [...byDay.values()]
  const g = days.reduce((s, d) => s + d.ordersGrossCents, 0)
  const v = days.reduce((s, d) => s + d.ordersVatCents, 0)
  const dep = days.reduce((s, d) => s + d.depositsCents, 0)
  return { days, ordersGrossCents: g, ordersVatCents: v, ordersNetCents: g - v, depositsCents: dep, totalInclCents: g + dep }
}

export type RevenueSplit = { key: string; label: string; cents: number }

/** Revenue per table (QR orders): paid QR orders grouped by table id. */
export function revenueByTable(orders: InsightOrder[], tableLabel: Map<string, string>, zoneOfTable: Map<string, string>) {
  const tables = new Map<string, number>()
  const zones = new Map<string, number>()
  for (const o of orders) {
    if (o.order_type !== 'qr' || !o.table_id || o.spend_cents <= 0) continue
    tables.set(o.table_id, (tables.get(o.table_id) ?? 0) + o.spend_cents)
    const z = zoneOfTable.get(o.table_id) ?? '—'
    zones.set(z, (zones.get(z) ?? 0) + o.spend_cents)
  }
  const sort = (m: Map<string, number>, label: (k: string) => string): RevenueSplit[] =>
    [...m.entries()].map(([key, cents]) => ({ key, label: label(key), cents })).sort((a, b) => b.cents - a.cents)
  return {
    perTable: sort(tables, (k) => tableLabel.get(k) ?? '—'),
    perZone: sort(zones, (k) => k),
  }
}

/** Revenue per menu category: item line totals of paid orders (items without a menu link → "other"). */
export function revenueByCategory(orders: InsightOrder[], categoryOfItem: Map<string, string>, categoryLabel: Map<string, string>): RevenueSplit[] {
  const m = new Map<string, number>()
  for (const o of orders) {
    if (o.spend_cents <= 0) continue
    for (const it of o.items) {
      const cat = (it.menu_item_id && categoryOfItem.get(it.menu_item_id)) || 'other'
      m.set(cat, (m.get(cat) ?? 0) + it.line_total_cents)
    }
  }
  return [...m.entries()]
    .map(([key, cents]) => ({ key, label: categoryLabel.get(key) ?? key, cents }))
    .sort((a, b) => b.cents - a.cents)
}

export type NoShowCost = {
  noShows: number
  noShowCovers: number
  /** Average dine-in (QR) spend per attended cover; null = not enough data. */
  avgSpendPerCoverCents: number | null
  estimateCents: number | null
}

/**
 * Estimate = no-show covers × average dine-in spend per attended cover, both
 * from this restaurant's own rows in the range. Null when there is no spend
 * data or no attended covers — the UI then says "Not enough data".
 */
export function computeNoShowCost(orders: InsightOrder[], bookings: InsightBooking[]): NoShowCost {
  const noShows = bookings.filter((b) => b.status === 'no_show')
  const noShowCovers = noShows.reduce((s, b) => s + b.party_size, 0)
  const attendedCovers = bookings.filter((b) => b.status === 'attended').reduce((s, b) => s + b.party_size, 0)
  const qrRevenue = orders.filter((o) => o.order_type === 'qr' && o.spend_cents > 0).reduce((s, o) => s + o.spend_cents, 0)
  const avg = attendedCovers > 0 && qrRevenue > 0 ? Math.round(qrRevenue / attendedCovers) : null
  return {
    noShows: noShows.length,
    noShowCovers,
    avgSpendPerCoverCents: avg,
    estimateCents: avg !== null ? avg * noShowCovers : null,
  }
}
