// lib/dashboard/staff/ensureOwnerStaffRow.ts
//
// STAFF-1: nothing in app code ever created a restaurant_staff owner row —
// the only rows that ever existed came from one-time migration backfills
// (018, then 026). This helper is the going-forward fix, called from two
// places: draft-creation (the normal path) and assertDashboardWriteAllowed
// (the self-repair safety net for any restaurant that still slips through).

import 'server-only'
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'

export type OwnerStaffRow = {
  id: string
  role: 'owner'
  display_name: string
  language: 'nl' | 'en'
}

type ProfileRow = { locale: string | null }
type RestaurantStaffSelectRow = {
  id: string
  role: string
  display_name: string
  language: string
}

/**
 * Ensures an active owner `restaurant_staff` row exists for (restaurantId,
 * userId). Safe to call more than once — the upsert is a no-op on repeat
 * calls (UNIQUE (restaurant_id, user_id)).
 *
 * Returns null (never throws) when:
 *   - the insert collides with `restaurant_staff_one_owner` (a DIFFERENT
 *     user already holds the active owner role for this restaurant) — we
 *     never overwrite or deactivate an existing owner
 *   - any other DB error occurs
 */
export async function ensureOwnerStaffRow(args: {
  restaurantId: string
  userId: string
  email: string | null
}): Promise<OwnerStaffRow | null> {
  try {
    const admin = await createSupabaseServerClientAdmin()

    const { data: profile } = await admin
      .from('profiles')
      .select('locale')
      .eq('id', args.userId)
      .maybeSingle<ProfileRow>()

    const language: 'nl' | 'en' = profile?.locale === 'en' ? 'en' : 'nl'
    const displayName = args.email?.trim() || 'Owner'

    const { error: upsertErr } = await admin
      .from('restaurant_staff')
      .upsert(
        {
          restaurant_id: args.restaurantId,
          user_id: args.userId,
          role: 'owner',
          display_name: displayName,
          language,
        },
        { onConflict: 'restaurant_id,user_id', ignoreDuplicates: true }
      )

    if (upsertErr) {
      // 23505 = unique_violation. ON CONFLICT (restaurant_id, user_id) only
      // suppresses conflicts on THAT constraint — a conflict here means the
      // partial unique index restaurant_staff_one_owner fired instead, i.e.
      // a different user already actively owns this restaurant.
      if (upsertErr.code === '23505') {
        console.error('[ensureOwnerStaffRow] a different active owner already exists', {
          restaurantId: args.restaurantId,
          userId: args.userId,
        })
        return null
      }
      console.error('[ensureOwnerStaffRow] upsert failed', upsertErr.message)
      return null
    }

    const { data: row, error: selectErr } = await admin
      .from('restaurant_staff')
      .select('id, role, display_name, language')
      .eq('restaurant_id', args.restaurantId)
      .eq('user_id', args.userId)
      .is('deactivated_at', null)
      .maybeSingle<RestaurantStaffSelectRow>()

    if (selectErr || !row) {
      console.error('[ensureOwnerStaffRow] select-back failed', selectErr?.message)
      return null
    }

    return {
      id: row.id,
      role: 'owner',
      display_name: row.display_name,
      language: row.language === 'en' ? 'en' : 'nl',
    }
  } catch (err) {
    console.error('[ensureOwnerStaffRow]', err)
    return null
  }
}
