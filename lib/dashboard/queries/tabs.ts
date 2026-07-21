import 'server-only'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Database } from '@/packages/db/types'

type TabRow = Database['public']['Tables']['tabs']['Row']
type OrderRow = Database['public']['Tables']['orders']['Row']

export type TabWithOrders = TabRow & { orders: OrderRow[] }

/**
 * Tab query helpers (session client, RLS applies).
 */

export async function getOpenTabsWithItems(
  restaurantId: string
): Promise<TabWithOrders[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('tabs')
    .select('*, orders(*)')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'open')
    .order('opened_at', { ascending: true })
  if (error) throw error
  return data as TabWithOrders[]
}

export async function getTabById(
  restaurantId: string,
  id: string
): Promise<TabWithOrders | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('tabs')
    .select('*, orders(*)')
    .eq('restaurant_id', restaurantId)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as TabWithOrders | null
}
