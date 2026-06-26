// lib/booking/openingHours.ts
//
// Compute the set of ISO weekdays (1=Mon .. 7=Sun) on which a restaurant
// accepts reservations. Used by the C4.3 date picker to grey out closed
// days without making one query per calendar cell.
//
// Server-only. Uses the admin client because RLS hides availability rows
// for non-live restaurants from anonymous callers.

import { createSupabaseServerClientAdmin } from '@/lib/supabase/server';

/**
 * Returns the sorted distinct ISO day-of-week values (1=Mon .. 7=Sun) on
 * which `restaurantId` has at least one active availability row with a
 * service scope that includes reservations.
 *
 * Returns `[]` on error or when the restaurant has no rows.
 */
export async function loadOpenDaysOfWeek(
  restaurantId: string,
  hoursPerServiceOverride: boolean,
): Promise<number[]> {
  const supabase = await createSupabaseServerClientAdmin();
  const scopeFilter = hoursPerServiceOverride ? ['all', 'reservations'] : ['all'];

  const { data, error } = await supabase
    .from('availability')
    .select('day_of_week')
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)
    .in('service_scope', scopeFilter)
    .returns<{ day_of_week: number }[]>();

  if (error || !data) {
    if (error) console.error('[booking/openingHours] load failed', { code: error.code });
    return [];
  }

  const set = new Set<number>();
  for (const row of data) {
    if (Number.isInteger(row.day_of_week) && row.day_of_week >= 1 && row.day_of_week <= 7) {
      set.add(row.day_of_week);
    }
  }
  return [...set].sort((a, b) => a - b);
}
