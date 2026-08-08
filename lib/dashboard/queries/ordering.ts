import 'server-only'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { OrderingPayload } from '@/lib/dashboard/settings/orderingValidation'

/**
 * Takeaway-ordering-settings (D5.4) query helpers. Session client — RLS's
 * owner-all policy on `restaurants` covers this; the `restaurant_id` filter
 * is belt-and-braces on top of that.
 *
 * `service_takeaway_enabled` is read-only here: it decides whether the page
 * renders the editor or an informational "not enabled" card, but it's never
 * written by this unit (see orderingValidation.ts's header comment).
 */

export type OrderingInitialData = {
  config: OrderingPayload
  serviceTakeawayEnabled: boolean
}

type RawRow = {
  takeaway_prep_time_minutes: number | null
  takeaway_min_order_cents: number | null
  takeaway_slot_interval_minutes: number | null
  takeaway_accepting_orders: boolean
  takeaway_item_notes_allowed: boolean
  takeaway_scheduled_orders_allowed: boolean
  service_takeaway_enabled: boolean
}

export async function getOrderingInitialData(restaurantId: string): Promise<OrderingInitialData> {
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from('restaurants')
    .select(
      'takeaway_prep_time_minutes, takeaway_min_order_cents, takeaway_slot_interval_minutes, takeaway_accepting_orders, takeaway_item_notes_allowed, takeaway_scheduled_orders_allowed, service_takeaway_enabled',
    )
    .eq('id', restaurantId)
    .single<RawRow>()
  if (error) throw error

  return {
    config: {
      takeaway_prep_time_minutes: data.takeaway_prep_time_minutes ?? 20,
      takeaway_min_order_cents: data.takeaway_min_order_cents ?? 0,
      takeaway_slot_interval_minutes: data.takeaway_slot_interval_minutes ?? 15,
      takeaway_accepting_orders: data.takeaway_accepting_orders,
      takeaway_item_notes_allowed: data.takeaway_item_notes_allowed,
      takeaway_scheduled_orders_allowed: data.takeaway_scheduled_orders_allowed,
    },
    serviceTakeawayEnabled: data.service_takeaway_enabled,
  }
}
