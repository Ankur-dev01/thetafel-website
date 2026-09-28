// lib/notifications/restaurant/resolveRecipient.ts
//
// Resolves who a restaurant-facing notification email goes to, in what
// locale, and whether each event's toggle is on. Shared by the three
// D5.6b dispatchers (new booking, new order, booking cancelled).

import 'server-only'
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'

export type RestaurantRecipient = {
  email: string | null
  locale: 'nl' | 'en'
  restaurantName: string
  toggles: {
    newBooking: boolean
    newOrder: boolean
    bookingCancelled: boolean
  }
}

// Explicit row types — the notify_restaurant_* columns aren't in
// packages/db/types.ts yet (migration 025 landed after codegen, same
// handoff as D5.6a's notify_* columns). Generic override on
// .maybeSingle() sidesteps the Database-generic column check.
type RestaurantRow = {
  user_id: string
  display_name: string | null
  legal_name: string | null
  slug: string
  contact_email: string | null
  notify_restaurant_new_booking: boolean | null
  notify_restaurant_new_order: boolean | null
  notify_restaurant_booking_cancelled: boolean | null
}

type StaffLanguageRow = {
  language: string | null
}

export async function resolveRestaurantRecipient(
  restaurantId: string
): Promise<RestaurantRecipient | null> {
  try {
    const admin = await createSupabaseServerClientAdmin()

    const { data: restaurant, error: restaurantErr } = await admin
      .from('restaurants')
      .select(
        'user_id, display_name, legal_name, slug, contact_email, notify_restaurant_new_booking, notify_restaurant_new_order, notify_restaurant_booking_cancelled'
      )
      .eq('id', restaurantId)
      .maybeSingle<RestaurantRow>()

    if (restaurantErr || !restaurant) {
      if (restaurantErr) {
        console.error('[resolveRestaurantRecipient] restaurant lookup failed', restaurantErr.message)
      }
      return null
    }

    // Not every live restaurant has a restaurant_staff row (2 of 5 live
    // restaurants don't, verified live 2026-09-29) — fall back to 'nl'
    // without treating a missing row as an error.
    const { data: staffRow } = await admin
      .from('restaurant_staff')
      .select('language')
      .eq('restaurant_id', restaurantId)
      .eq('user_id', restaurant.user_id)
      .is('deactivated_at', null)
      .maybeSingle<StaffLanguageRow>()

    const locale: 'nl' | 'en' = staffRow?.language === 'en' ? 'en' : 'nl'

    const restaurantName =
      restaurant.display_name ?? restaurant.legal_name ?? restaurant.slug

    const trimmedEmail = restaurant.contact_email?.trim() || null

    return {
      email: trimmedEmail,
      locale,
      restaurantName,
      toggles: {
        newBooking: restaurant.notify_restaurant_new_booking ?? true,
        newOrder: restaurant.notify_restaurant_new_order ?? true,
        bookingCancelled: restaurant.notify_restaurant_booking_cancelled ?? true,
      },
    }
  } catch (err) {
    console.error('[resolveRestaurantRecipient] unexpected error', err)
    return null
  }
}
