import 'server-only'

import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  dashboardAccountSecurityRateLimit,
  dashboardMutationRateLimit,
} from '@/lib/dashboard/rateLimit'
import { findActingRestaurantId } from '@/lib/dashboard/staff/actingRestaurant'
import { assertDashboardWriteAllowed } from '@/lib/dashboard/guards/assertDashboardWriteAllowed'
import type { Database } from '@/packages/db/types'

type RestaurantStaffRow = Database['public']['Tables']['restaurant_staff']['Row']
type SessionClient = Awaited<ReturnType<typeof createSupabaseServerClient>>

const NO_STORE = { 'Cache-Control': 'no-store' } as const

export type AccountContext = {
  supabase: SessionClient
  user: User
  restaurantId: string
  staff: RestaurantStaffRow
}

export type AccountContextResult =
  | { ok: true; ctx: AccountContext }
  | { ok: false; response: NextResponse }

function fail(code: string, status: number, extra: Record<string, string> = {}): AccountContextResult {
  return {
    ok: false,
    response: NextResponse.json({ ok: false, code }, { status, headers: { ...extra, ...NO_STORE } }),
  }
}

/**
 * Auth → rate-limit → restaurant → write-gate preamble for the self-service
 * account routes. Open to every active staff role ('account.self_edit'); the
 * restaurant is the one the caller is staff at (or owns, for an owner whose
 * restaurant_staff row is missing — assertDashboardWriteAllowed self-repairs).
 *
 * `sensitive: true` (password / email change) additionally spends from the
 * 5-per-15-minutes credential bucket.
 */
export async function resolveAccountContext(
  opts: { sensitive?: boolean } = {},
): Promise<AccountContextResult> {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return fail('not_authenticated', 401)

  const rl = await (opts.sensitive
    ? dashboardAccountSecurityRateLimit(user.id)
    : dashboardMutationRateLimit(user.id))
  if (!rl.ok) return fail('rate_limited', 429, { 'Retry-After': String(rl.retryAfter ?? 60) })

  const restaurantId = await findActingRestaurantId(supabase, user.id)
  if (!restaurantId) return fail('restaurant_not_found', 404)

  const guard = await assertDashboardWriteAllowed(restaurantId, 'account.self_edit', user)
  if (!guard.ok) return fail(guard.reason, guard.httpStatus)

  return { ok: true, ctx: { supabase, user, restaurantId, staff: guard.staff } }
}

export { NO_STORE }
