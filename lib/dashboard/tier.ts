import 'server-only'

import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'

export type RestaurantTier = 'starter' | 'plus' | 'premium'

const RANK: Record<RestaurantTier, number> = { starter: 0, plus: 1, premium: 2 }

/**
 * The restaurant's plan, for feature gating (Guests = Plus+, VIP + revenue
 * insights = Premium). `subscriptions` RLS is owner-only, so this reads with
 * the service-role client — managers and service staff must get the same
 * gating as the owner. No live subscription row → 'starter'.
 */
export async function getRestaurantTier(restaurantId: string): Promise<RestaurantTier> {
  const admin = await createSupabaseServerClientAdmin()
  const { data } = await admin
    .from('subscriptions')
    .select('tier')
    .eq('restaurant_id', restaurantId)
    .in('status', ['trialing', 'active', 'past_due', 'suspended'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ tier: RestaurantTier }>()
  const tier = data?.tier
  return tier === 'plus' || tier === 'premium' ? tier : 'starter'
}

export function tierAtLeast(tier: RestaurantTier, min: RestaurantTier): boolean {
  return RANK[tier] >= RANK[min]
}
