import { cache } from 'react'
import { createSupabasePublicClient } from './supabasePublic'

/**
 * Public-facing restaurant shape returned to consumer pages.
 *
 * Only fields that are safe to expose to anonymous visitors are listed here.
 * Anything sensitive (Mollie tokens, subscription details, user_id, etc.) is
 * deliberately omitted even though RLS would block them anyway — defence in
 * depth.
 */
export type PublicRestaurant = {
  id: string
  slug: string
  display_name: string | null
  legal_name: string | null
  cuisine_type: string | null
  hero_image_url: string | null
  contact_phone: string | null
  contact_email: string | null
  legal_address_street: string | null
  legal_address_house_number: string | null
  legal_address_house_letter: string | null
  legal_address_house_number_addition: string | null
  legal_address_postcode: string | null
  legal_address_city: string | null
  service_reservations_enabled: boolean
  service_takeaway_enabled: boolean
  service_qr_enabled: boolean
  brand_primary_hex: string | null
  brand_secondary_hex: string | null
  brand_display_font_family: string | null
  brand_logo_url: string | null
  brand_menu_texture_url: string | null
  qr_widget_accent_color: string | null
  qr_item_notes_enabled: boolean
  qr_pay_now_enabled: boolean | null
  qr_pay_at_table_enabled: boolean | null
}

/**
 * Resolve a restaurant by URL slug for public consumer pages.
 *
 * Returns null if:
 *   - the slug is empty / malformed
 *   - no restaurant matches the slug
 *   - the matching restaurant is not status='live'
 *
 * We pin status='live' explicitly here (in addition to relying on RLS) because
 * the `restaurants_owner_all` policy permits an owner to read their own row at
 * any status. The cookies-free public client used here doesn't carry an auth
 * session so the owner-policy wouldn't apply anyway — but the explicit filter
 * is kept as defence in depth in case the client ever changes.
 *
 * Uses the public (anon-only, cookies-free) Supabase client so the calling
 * page can be statically rendered with ISR.
 *
 * Wrapped in React.cache so that multiple components in the same render
 * (layout, page, header) trigger a single Supabase round-trip per request.
 */
export const resolveRestaurantBySlug = cache(
  async (slug: string): Promise<PublicRestaurant | null> => {
    if (!slug || typeof slug !== 'string' || slug.trim().length === 0) {
      return null
    }

    const supabase = createSupabasePublicClient()

    const { data, error } = await supabase
      .from('restaurants')
      .select(
        [
          'id',
          'slug',
          'display_name',
          'legal_name',
          'cuisine_type',
          'hero_image_url',
          'contact_phone',
          'contact_email',
          'legal_address_street',
          'legal_address_house_number',
          'legal_address_house_letter',
          'legal_address_house_number_addition',
          'legal_address_postcode',
          'legal_address_city',
          'service_reservations_enabled',
          'service_takeaway_enabled',
          'service_qr_enabled',
          'brand_primary_hex',
          'brand_secondary_hex',
          'brand_display_font_family',
          'brand_logo_url',
          'brand_menu_texture_url',
          'qr_widget_accent_color',
          'qr_item_notes_enabled',
          'qr_pay_now_enabled',
          'qr_pay_at_table_enabled',
        ].join(',')
      )
      .eq('slug', slug)
      .eq('status', 'live')
      .maybeSingle()

    if (error) {
      console.error('[resolveRestaurantBySlug] supabase error', {
        slug,
        error,
      })
      return null
    }

    if (!data) return null

    return data as unknown as PublicRestaurant
  }
)
