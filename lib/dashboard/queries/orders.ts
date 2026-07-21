import 'server-only'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Database } from '@/packages/db/types'

type OrderRow = Database['public']['Tables']['orders']['Row']

/**
 * Order-queue query helpers (session client, RLS applies).
 * "Active" = any non-terminal status the queue acts on.
 */

const ACTIVE_STATUSES = ['pending', 'confirmed', 'preparing', 'ready'] as const

export async function getActiveOrders(restaurantId: string): Promise<OrderRow[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .in('status', [...ACTIVE_STATUSES])
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function getOrderById(
  restaurantId: string,
  id: string
): Promise<OrderRow | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}
