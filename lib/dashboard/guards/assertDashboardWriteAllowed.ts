import 'server-only'

import type { User } from '@supabase/supabase-js'
import { createSupabaseServerClient, createSupabaseServerClientAdmin } from '@/lib/supabase/server'
import type { Database } from '@/packages/db/types'
import { can, type DashboardAction } from '@/lib/dashboard/permissions'
import { ensureOwnerStaffRow } from '@/lib/dashboard/staff/ensureOwnerStaffRow'

type RestaurantStaffRow = Database['public']['Tables']['restaurant_staff']['Row']

export type AssertDashboardWriteAllowedResult =
  | { ok: true; staff: RestaurantStaffRow }
  | { ok: false; reason: string; httpStatus: number }

/**
 * Guard called at the top of every mutating dashboard route from D1 onward.
 * Resolves the acting user, loads their restaurant_staff row, and checks the
 * action against the permission map. Never throws — callers branch on `ok`.
 *
 * A billing-suspended pause (restaurants.pause_reason='billing_suspended')
 * only blocks the CONSUMER surface; the dashboard stays fully usable so the
 * owner can reach billing settings to recover. This guard does not consult
 * paused_at at all for that reason.
 *
 * Does not audit on its own — a rejection here is silent. The calling route
 * audits after a successful mutation. (D9.1 will decide whether rejections
 * also need an audit trail.)
 *
 * `knownUser` lets a caller that already ran `auth.getUser()` this request
 * (e.g. resolveMenuMutationContext) skip the redundant second GoTrue round
 * trip. Callers that haven't resolved a user yet can omit it — this guard
 * then falls back to resolving it itself, unchanged from prior behavior.
 */
export async function assertDashboardWriteAllowed(
  restaurantId: string,
  action: DashboardAction,
  knownUser?: User,
): Promise<AssertDashboardWriteAllowedResult> {
  const supabase = await createSupabaseServerClient()

  let user = knownUser ?? null
  if (!user) {
    const {
      data: { user: fetchedUser },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !fetchedUser) {
      return { ok: false, reason: 'not_authenticated', httpStatus: 401 }
    }
    user = fetchedUser
  }

  const { data: staffRow } = await supabase
    .from('restaurant_staff')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('user_id', user.id)
    .is('deactivated_at', null)
    .maybeSingle()

  let staff = staffRow

  if (!staff) {
    // STAFF-1: the D0.1 backfill was one-time only and nothing created
    // restaurant_staff rows for restaurants made afterward — draft creation
    // now calls ensureOwnerStaffRow() up front (see
    // app/api/v1/restaurants/draft/route.ts), but this is the safety net
    // for any restaurant that still slips through. If the caller genuinely
    // owns this restaurant, self-repair by creating the missing row instead
    // of 403ing them out of their own dashboard.
    const { data: restaurantRow } = await supabase
      .from('restaurants')
      .select('user_id')
      .eq('id', restaurantId)
      .maybeSingle<{ user_id: string }>()

    if (restaurantRow?.user_id === user.id) {
      const repaired = await ensureOwnerStaffRow({
        restaurantId,
        userId: user.id,
        email: user.email ?? null,
      })

      if (repaired) {
        const { data: refetched } = await supabase
          .from('restaurant_staff')
          .select('*')
          .eq('id', repaired.id)
          .maybeSingle()
        staff = refetched

        try {
          const admin = await createSupabaseServerClientAdmin()
          await admin.from('dashboard_audit_logs').insert({
            restaurant_id: restaurantId,
            staff_id: repaired.id,
            event_type: 'staff.owner_row_repaired',
            event_data: { restaurantId, userId: user.id },
          })
        } catch (err) {
          console.error('[assertDashboardWriteAllowed] owner-row-repaired audit failed', err)
        }
      }
    }

    if (!staff) {
      return { ok: false, reason: 'not_staff', httpStatus: 403 }
    }
  }

  if (!can(staff.role, action)) {
    return { ok: false, reason: 'forbidden', httpStatus: 403 }
  }

  return { ok: true, staff }
}
