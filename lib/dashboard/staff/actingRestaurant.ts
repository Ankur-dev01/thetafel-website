import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * The restaurant a logged-in dashboard user acts for: the one they hold an
 * ACTIVE restaurant_staff row at; for an owner whose staff row is missing
 * (STAFF-1 self-repair case), the restaurant they own. Roles are per
 * restaurant and v1 assumes one restaurant per login.
 *
 * Runs with the caller's own (RLS) client — the staff-membership SELECT
 * policies (migration 031) make both lookups work for non-owner staff.
 */
export async function findActingRestaurantId(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data: membership } = await supabase
    .from('restaurant_staff')
    .select('restaurant_id')
    .eq('user_id', userId)
    .is('deactivated_at', null)
    .limit(1)
    .maybeSingle<{ restaurant_id: string }>()
  if (membership?.restaurant_id) {
    const { data: alive } = await supabase
      .from('restaurants')
      .select('id')
      .eq('id', membership.restaurant_id)
      .is('deleted_at', null)
      .maybeSingle<{ id: string }>()
    if (alive) return alive.id
  }

  const { data: owned } = await supabase
    .from('restaurants')
    .select('id')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle<{ id: string }>()
  return owned?.id ?? null
}

/**
 * Drop-in for the old `supabase.from('restaurants').select(cols).eq('user_id', uid)
 * .is('deleted_at', null).maybeSingle()` used by dashboard routes: resolves the
 * restaurant through the caller's staff membership (owner included) and selects
 * `columns` from it. Same `{ data, error }` shape; `data` is null when the user
 * has no active membership and owns nothing.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function selectActingRestaurant(supabase: SupabaseClient, userId: string, columns: string): Promise<{ data: any; error: any }> {
  const id = await findActingRestaurantId(supabase, userId)
  if (!id) return { data: null, error: null }
  return supabase.from('restaurants').select(columns).eq('id', id).maybeSingle()
}
