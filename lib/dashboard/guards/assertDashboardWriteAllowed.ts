import 'server-only'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Database } from '@/packages/db/types'
import { can, type DashboardAction } from '@/lib/dashboard/permissions'

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
 */
export async function assertDashboardWriteAllowed(
  restaurantId: string,
  action: DashboardAction
): Promise<AssertDashboardWriteAllowedResult> {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { ok: false, reason: 'not_authenticated', httpStatus: 401 }
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
    // Unlike resolveDashboardContext (read-side), this guard does not
    // synthesize a fallback staff row for the owner-without-backfill race:
    // every caller expects a real staff.id (e.g. for audit attribution), and
    // the D0.1 backfill guarantees the row exists for every live restaurant.
    // If this ever fires for a genuine owner, resolveDashboardContext's
    // 'staff.missing_owner_row' audit event will have already flagged it.
    return { ok: false, reason: 'not_staff', httpStatus: 403 }
  }

  if (!can(staff.role, action)) {
    return { ok: false, reason: 'forbidden', httpStatus: 403 }
  }

  return { ok: true, staff }
}
