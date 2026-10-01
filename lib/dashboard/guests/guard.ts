import 'server-only'

import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { assertDashboardWriteAllowed } from '@/lib/dashboard/guards/assertDashboardWriteAllowed'
import { findActingRestaurantId } from '@/lib/dashboard/staff/actingRestaurant'
import { dashboardMutationRateLimit } from '@/lib/dashboard/rateLimit'
import { getRestaurantTier, tierAtLeast, type RestaurantTier } from '@/lib/dashboard/tier'
import type { DashboardAction } from '@/lib/dashboard/permissions'
import type { Database } from '@/packages/db/types'

type RestaurantStaffRow = Database['public']['Tables']['restaurant_staff']['Row']

export const NO_STORE = { 'Cache-Control': 'private, no-store' } as const

export type FeatureContext = {
  user: User
  restaurantId: string
  staff: RestaurantStaffRow
  tier: RestaurantTier
}

/**
 * Preamble for Guests / Insights routes: session → acting restaurant (staff
 * membership) → role permission (`action`) → plan (`minTier`, via the
 * service-role tier lookup so managers and service staff get the same gating
 * as the owner). Writes also spend from the dashboard mutation rate limit.
 */
export async function resolveFeatureContext(
  action: DashboardAction,
  minTier: RestaurantTier,
  opts: { write?: boolean } = {},
): Promise<{ ok: true; ctx: FeatureContext } | { ok: false; response: NextResponse }> {
  const fail = (code: string, status: number) =>
    ({ ok: false, response: NextResponse.json({ ok: false, code }, { status, headers: NO_STORE }) }) as const

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail('not_authenticated', 401)

  if (opts.write) {
    const rl = await dashboardMutationRateLimit(user.id)
    if (!rl.ok) return fail('rate_limited', 429)
  }

  const restaurantId = await findActingRestaurantId(supabase, user.id)
  if (!restaurantId) return fail('restaurant_not_found', 404)

  const guard = await assertDashboardWriteAllowed(restaurantId, action, user)
  if (!guard.ok) return fail(guard.reason, guard.httpStatus)

  const tier = await getRestaurantTier(restaurantId)
  if (!tierAtLeast(tier, minTier)) return fail('upgrade_required', 402)

  return { ok: true, ctx: { user, restaurantId, staff: guard.staff, tier } }
}
