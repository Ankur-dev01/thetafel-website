import 'server-only'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Database } from '@/packages/db/types'

/**
 * Server-side query helpers for the Vandaag (Today) page. All use the
 * session client so RLS applies; never the admin client.
 *
 * "Today" is the restaurant-local calendar day (Europe/Amsterdam).
 */

type BookingRow = Database['public']['Tables']['bookings']['Row']
type OrderRow = Database['public']['Tables']['orders']['Row']
type TabRow = Database['public']['Tables']['tabs']['Row']

export type TodayAlert = {
  id: string
  tone: 'warning' | 'danger' | 'success' | 'neutral'
  label: string
  actionHref?: string
  actionLabel?: string
}

const AMS_TZ = 'Europe/Amsterdam'

/** [startUtcIso, endUtcIso) bounds of "today" in restaurant-local time. */
export function todayBoundsUtc(now: Date = new Date()): [string, string] {
  // en-CA yields YYYY-MM-DD
  const localDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: AMS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  // Amsterdam offset for that date (CET/CEST) — derive from the formatted parts.
  const probe = new Date(`${localDate}T00:00:00Z`)
  const offsetMinutes = getTimezoneOffsetMinutes(probe)
  const startUtc = new Date(probe.getTime() - offsetMinutes * 60000)
  const endUtc = new Date(startUtc.getTime() + 24 * 3600 * 1000)
  return [startUtc.toISOString(), endUtc.toISOString()]
}

function getTimezoneOffsetMinutes(utcDate: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: AMS_TZ,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(utcDate)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'))
  return Math.round((asUtc - utcDate.getTime()) / 60000)
}

export async function getTodayBookings(restaurantId: string): Promise<BookingRow[]> {
  const supabase = await createSupabaseServerClient()
  const [start, end] = todayBoundsUtc()
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .gte('slot_time', start)
    .lt('slot_time', end)
    .order('slot_time', { ascending: true })
  if (error) throw error
  return data
}

export async function getTodayOrders(restaurantId: string): Promise<OrderRow[]> {
  const supabase = await createSupabaseServerClient()
  const [start, end] = todayBoundsUtc()
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .or(
      `and(created_at.gte.${start},created_at.lt.${end}),and(pickup_time.gte.${start},pickup_time.lt.${end})`
    )
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getOpenTabs(restaurantId: string): Promise<TabRow[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('tabs')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'open')
    .order('opened_at', { ascending: true })
  if (error) throw error
  return data
}

/** Alert queries land in D1.2 — empty until then. */
export async function getTodayAlerts(restaurantId: string): Promise<TodayAlert[]> {
  void restaurantId
  return []
}
