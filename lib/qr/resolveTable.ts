import { cache } from 'react'
import { createSupabasePublicClient } from '@/lib/consumer/supabasePublic'
import {
  resolveRestaurantBySlug,
  type PublicRestaurant,
} from '@/lib/consumer/resolveRestaurant'

export type QrTable = {
  id: string
  label: string
  seats: number
  zone_id: string
  qr_token: string
}

export type ResolveResult =
  | { status: 'ok'; restaurant: PublicRestaurant; table: QrTable }
  | { status: 'restaurant_not_found' }
  | { status: 'unknown_table' }
  | { status: 'qr_disabled_restaurant' }
  | { status: 'qr_disabled_table' }

/**
 * Resolve a QR scan to a restaurant + table pair.
 *
 * Wrapped in React.cache so the page, header, and welcome component share a
 * single Supabase round-trip per request.
 */
export const resolveTable = cache(
  async (slug: string, qrToken: string): Promise<ResolveResult> => {
    const restaurant = await resolveRestaurantBySlug(slug)
    if (!restaurant) return { status: 'restaurant_not_found' }

    if (!restaurant.service_qr_enabled) {
      return { status: 'qr_disabled_restaurant' }
    }

    const supabase = createSupabasePublicClient()

    const { data, error } = await supabase
      .from('restaurant_tables')
      .select('id, label, seats, zone_id, qr_token, is_qr_enabled')
      .eq('restaurant_id', restaurant.id)
      .eq('qr_token', qrToken)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) {
      console.error('[resolveTable] supabase error', { slug, error })
      return { status: 'unknown_table' }
    }

    if (!data) return { status: 'unknown_table' }

    if (!data.is_qr_enabled) return { status: 'qr_disabled_table' }

    const table: QrTable = {
      id: data.id,
      label: data.label,
      seats: data.seats,
      zone_id: data.zone_id,
      qr_token: data.qr_token as string,
    }

    return { status: 'ok', restaurant, table }
  }
)
