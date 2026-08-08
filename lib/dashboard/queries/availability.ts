import 'server-only'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { DayOfWeek, ServiceScope } from '@/lib/dashboard/settings/hoursValidation'

/**
 * Availability (opening hours) query helpers (D5.1). Session client
 * throughout — RLS grants the owner full SELECT on `availability`; the
 * `restaurant_id` filter here is belt-and-braces on top of that.
 *
 * Closed day representation: absence of a row, not `is_active=false`. Every
 * existing row in prod has `is_active=true` — this read path follows the
 * same convention rather than trying to interpret `is_active=false`.
 */

export type DayConfig = {
  enabled: boolean
  openTime: string // 'HH:MM'
  closeTime: string // 'HH:MM'
  tagBrunch: boolean
  tagLunch: boolean
  tagDinner: boolean
}

const CLOSED_DAY: DayConfig = {
  enabled: false,
  openTime: '',
  closeTime: '',
  tagBrunch: false,
  tagLunch: false,
  tagDinner: false,
}

export type HoursEditorInitialData = {
  hoursPerServiceOverride: boolean
  days: Record<ServiceScope, Record<DayOfWeek, DayConfig>>
  restaurantSlug: string
}

function emptyWeek(): Record<DayOfWeek, DayConfig> {
  return {
    1: { ...CLOSED_DAY },
    2: { ...CLOSED_DAY },
    3: { ...CLOSED_DAY },
    4: { ...CLOSED_DAY },
    5: { ...CLOSED_DAY },
    6: { ...CLOSED_DAY },
    7: { ...CLOSED_DAY },
  }
}

/** `time` columns arrive as 'HH:MM:SS'; the editor and the API both speak 'HH:MM'. */
function toHHMM(value: string): string {
  return value.slice(0, 5)
}

export async function getHoursEditorInitialData(
  restaurantId: string,
  restaurantSlug: string,
): Promise<HoursEditorInitialData> {
  const supabase = await createSupabaseServerClient()

  const [{ data: restaurant, error: restaurantError }, { data: rows, error: rowsError }] = await Promise.all([
    supabase
      .from('restaurants')
      .select('hours_per_service_override')
      .eq('id', restaurantId)
      .maybeSingle(),
    supabase
      .from('availability')
      .select('day_of_week, service_scope, open_time, close_time, tag_brunch, tag_lunch, tag_dinner')
      .eq('restaurant_id', restaurantId),
  ])
  if (restaurantError) throw restaurantError
  if (rowsError) throw rowsError

  const days: Record<ServiceScope, Record<DayOfWeek, DayConfig>> = {
    all: emptyWeek(),
    reservations: emptyWeek(),
    takeaway: emptyWeek(),
    qr: emptyWeek(),
  }

  for (const row of rows ?? []) {
    const scope = row.service_scope as ServiceScope
    const day = row.day_of_week as DayOfWeek
    if (!days[scope]) continue
    days[scope][day] = {
      enabled: true,
      openTime: toHHMM(row.open_time),
      closeTime: toHHMM(row.close_time),
      tagBrunch: row.tag_brunch,
      tagLunch: row.tag_lunch,
      tagDinner: row.tag_dinner,
    }
  }

  return {
    hoursPerServiceOverride: restaurant?.hours_per_service_override ?? false,
    days,
    restaurantSlug,
  }
}
