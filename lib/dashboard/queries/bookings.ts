import 'server-only'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Database } from '@/packages/db/types'

type BookingRow = Database['public']['Tables']['bookings']['Row']

/**
 * Booking query helpers (session client, RLS applies).
 * `date` is the restaurant-local calendar day as YYYY-MM-DD.
 */

export async function getBookingsForDay(
  restaurantId: string,
  date: string
): Promise<BookingRow[]> {
  const supabase = await createSupabaseServerClient()
  // slot_time is timestamptz; bound by the local day in Europe/Amsterdam.
  // Postgres evaluates the date math; keep it simple with a range filter on
  // the UTC day ± offset handled by the caller until D2.1 needs finer control.
  const start = `${date}T00:00:00+02:00`
  const end = `${date}T23:59:59.999+02:00`
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .gte('slot_time', start)
    .lte('slot_time', end)
    .order('slot_time', { ascending: true })
  if (error) throw error
  return data
}

export async function getBookingById(
  restaurantId: string,
  id: string
): Promise<BookingRow | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}
