import { cache } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export type AvailabilityRow = {
  day_of_week: number // 1=Mon ... 7=Sun (ISO 8601)
  service_scope: 'all' | 'reservations' | 'takeaway' | 'qr'
  open_time: string // "HH:MM:SS"
  close_time: string // "HH:MM:SS"
  closes_next_day: boolean
  is_active: boolean
}

/**
 * Resolve all active availability rows for a restaurant.
 *
 * Wrapped in React.cache so multiple components in the same render that need
 * hours (header, booking form, etc.) hit Supabase only once. RLS guarantees
 * we only see rows for live restaurants.
 *
 * Returns rows ordered by day_of_week then open_time for deterministic
 * downstream rendering. Inactive rows are excluded — if a restaurant has
 * temporarily disabled a day, it should be reported as closed.
 */
export const resolveHoursForRestaurant = cache(
  async (restaurantId: string): Promise<AvailabilityRow[]> => {
    if (!restaurantId || typeof restaurantId !== 'string') return []

    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase
      .from('availability')
      .select(
        'day_of_week, service_scope, open_time, close_time, closes_next_day, is_active'
      )
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .order('day_of_week', { ascending: true })
      .order('open_time', { ascending: true })

    if (error) {
      console.error('[resolveHoursForRestaurant] supabase error', {
        restaurantId,
        error,
      })
      return []
    }

    return (data ?? []) as AvailabilityRow[]
  }
)
