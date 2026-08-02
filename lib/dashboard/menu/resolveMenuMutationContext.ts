import 'server-only'

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { dashboardMutationRateLimit } from '@/lib/dashboard/rateLimit'
import { assertDashboardWriteAllowed } from '@/lib/dashboard/guards/assertDashboardWriteAllowed'
import type { DashboardAction } from '@/lib/dashboard/permissions'
import type { Database } from '@/packages/db/types'

type RestaurantStaffRow = Database['public']['Tables']['restaurant_staff']['Row']
type SessionClient = Awaited<ReturnType<typeof createSupabaseServerClient>>

/**
 * The auth → rate-limit → restaurant → permission preamble every D4.2 menu
 * mutation route runs before touching anything.
 *
 * D2.3/D3.2/D3.3/D3.4 each inline this block, which is fine for one or two
 * routes per unit; D4.2 ships four at once, so it lives here instead of being
 * copied four times. Behaviour is byte-for-byte the same as the inline
 * version — same order, same error codes, same headers.
 */

const NO_STORE = { 'Cache-Control': 'no-store' } as const

export type MenuMutationContext = {
  supabase: SessionClient
  restaurant: { id: string; slug: string }
  staff: RestaurantStaffRow
}

export type MenuMutationContextResult =
  | { ok: true; ctx: MenuMutationContext }
  | { ok: false; response: NextResponse }

export async function resolveMenuMutationContext(
  action: DashboardAction,
): Promise<MenuMutationContextResult> {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'not_authenticated' }, { status: 401, headers: NO_STORE }),
    }
  }

  const rl = await dashboardMutationRateLimit(user.id)
  if (!rl.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60), ...NO_STORE } },
      ),
    }
  }

  const { data: restaurant, error: restaurantError } = await supabase
    .from('restaurants')
    .select('id, slug')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (restaurantError || !restaurant) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'restaurant_not_found' }, { status: 404, headers: NO_STORE }),
    }
  }

  const guard = await assertDashboardWriteAllowed(restaurant.id, action)
  if (!guard.ok) {
    return {
      ok: false,
      response: NextResponse.json({ error: guard.reason }, { status: guard.httpStatus, headers: NO_STORE }),
    }
  }

  return {
    ok: true,
    ctx: { supabase, restaurant: { id: restaurant.id, slug: restaurant.slug }, staff: guard.staff },
  }
}
