import { cache } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'

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
}

/**
 * Resolve a restaurant by URL slug for public consumer pages.
 *
 * Returns `null` if no restaurant exists for the slug, or if the matching
 * restaurant is not `status = 'live'` (RLS blocks the row from being read
 * for both anon and authenticated callers when status is anything else).
 *
 * Wrapped in React's `cache()` so that multiple components in the same
 * server render that all need the restaurant (layout, page, header, etc.)
 * only trigger one Supabase round-trip per request.
 */
export const resolveRestaurantBySlug = cache(
  async (slug: string): Promise<PublicRestaurant | null> => {
    // Defensive: the dynamic segment should always be a non-empty string,
    // but if upstream code ever passes an empty value we want a clean null
    // rather than an "ilike-everything" query.
    if (!slug || typeof slug !== 'string' || slug.trim().length === 0) {
      return null
    }

    const supabase = await createSupabaseServerClient()

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
        ].join(',')
      )
      .eq('slug', slug)
      .maybeSingle()

    if (error) {
      // Log server-side so we can see this in Vercel logs if it ever fires,
      // but never throw — a public-facing route must degrade gracefully.
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
