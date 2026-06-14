import { NextResponse } from 'next/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Database } from '@/packages/db/types'

type Restaurant = Database['public']['Tables']['restaurants']['Row']

type AssertResult =
  | { ok: true; restaurant: Restaurant; user: User }
  | { ok: false; response: NextResponse }

/**
 * Server-side guard for onboarding mutation routes.
 *
 * Returns { ok: true, restaurant, user } when:
 *   - The user owns this restaurant
 *   - status === 'onboarding'
 *
 * Returns { ok: false, response } to early-return from the caller:
 *   - 401 if no authenticated user
 *   - 403 if the user doesn't own this restaurant
 *   - 404 if the restaurant doesn't exist
 *   - 409 { error: 'onboarding_locked', current_status } if status !== 'onboarding'
 *
 * Usage (explicit restaurantId from URL params):
 *   const guard = await assertOnboardingMutation(supabase, restaurantId)
 *   if (!guard.ok) return guard.response
 *   const { restaurant, user } = guard
 */
export async function assertOnboardingMutation(
  supabase: SupabaseClient<Database>,
  restaurantId: string
): Promise<AssertResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }),
    }
  }

  const { data: restaurant, error } = await supabase
    .from('restaurants')
    .select('*')
    .eq('id', restaurantId)
    .maybeSingle()

  if (error || !restaurant) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'restaurant_not_found' },
        { status: 404 }
      ),
    }
  }

  if (restaurant.user_id !== user.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'forbidden' }, { status: 403 }),
    }
  }

  if (restaurant.status !== 'onboarding') {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'onboarding_locked',
          current_status: restaurant.status,
          message:
            'This restaurant has completed onboarding. Use the dashboard to change configuration.',
        },
        { status: 409 }
      ),
    }
  }

  return { ok: true, restaurant, user }
}

/**
 * Variant for routes that don't take an explicit restaurantId in the URL
 * (e.g. the generic draft autosave route that resolves the restaurant from
 * the authenticated user's session). Returns the restaurant owned by the
 * current user, or an error response if no ownership or wrong status.
 *
 * Usage (session-scoped, no URL param):
 *   const guard = await assertOnboardingMutationForUser(supabase)
 *   if (!guard.ok) return guard.response
 *   const { restaurant, user } = guard
 */
export async function assertOnboardingMutationForUser(
  supabase: SupabaseClient<Database>
): Promise<AssertResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }),
    }
  }

  const { data: restaurant, error } = await supabase
    .from('restaurants')
    .select('*')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !restaurant) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'restaurant_not_found' },
        { status: 404 }
      ),
    }
  }

  if (restaurant.status !== 'onboarding') {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'onboarding_locked',
          current_status: restaurant.status,
          message:
            'This restaurant has completed onboarding. Use the dashboard to change configuration.',
        },
        { status: 409 }
      ),
    }
  }

  return { ok: true, restaurant, user }
}
