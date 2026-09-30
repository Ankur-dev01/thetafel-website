import 'server-only'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { after } from 'next/server'
import {
  createSupabaseServerClient,
  createSupabaseServerClientAdmin,
} from '@/lib/supabase/server'
import type { Database } from '@/packages/db/types'
import type { StaffRole } from '@/lib/dashboard/nav'
import { canViewPath, homePathFor } from '@/lib/dashboard/permissions'

type Restaurant = Database['public']['Tables']['restaurants']['Row']
type RestaurantStaffRow = Database['public']['Tables']['restaurant_staff']['Row']

export type DashboardStaff = {
  /** Null only when the synthetic-owner fallback fired (backfill race). */
  id: string | null
  role: StaffRole
  display_name: string
  language: 'nl' | 'en'
}

export type DashboardContext = {
  userId: string
  userEmail: string | null
  restaurant: Restaurant
  staff: DashboardStaff
}

/**
 * Resolve `{ user, restaurant, staff }` for the current dashboard request.
 *
 * Redirect rules (mirrors OnboardingShell):
 *   - no session            → /login?next=<current dashboard path>
 *   - no restaurant row     → /onboarding
 *   - status onboarding     → /onboarding
 *   - status pending_review → /onboarding/submitted
 *   - suspended/cancelled   → /login
 *   - status live           → resolve staff membership and return
 *
 * Staff membership: the owner's restaurant_staff row was backfilled in D0.1.
 * If it is somehow missing but the user IS restaurants.user_id, fall back to
 * a synthetic owner and log a warning to dashboard_audit_logs. A user who is
 * neither staff nor the owner is bounced to /login.
 */
export async function resolveDashboardContext(
  locale: 'nl' | 'en'
): Promise<DashboardContext> {
  const localePrefix = locale === 'en' ? '/en' : ''
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    const hdrs = await headers()
    const pathname = hdrs.get('x-pathname') ?? `${localePrefix}/dashboard`
    redirect(`${localePrefix}/login?next=${encodeURIComponent(pathname)}`)
  }

  // The restaurant is resolved through the caller's ACTIVE restaurant_staff row
  // (owner and staff alike; RLS staff-membership policies, migration 031, make
  // the read work for non-owners). An owner without a staff row (STAFF-1 race)
  // still resolves via restaurants.user_id.
  const { data: memberships } = await supabase.from('restaurant_staff').select('*').eq('user_id', user.id)
  const staffRow = (memberships ?? []).find((m) => m.deactivated_at === null) ?? null

  let restaurant = null
  if (staffRow) {
    const { data } = await supabase
      .from('restaurants')
      .select('*')
      .eq('id', staffRow.restaurant_id)
      .is('deleted_at', null)
      .maybeSingle()
    restaurant = data
  }
  if (!restaurant) {
    const { data } = await supabase
      .from('restaurants')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle()
    restaurant = data
  }

  if (!restaurant) {
    // Had dashboard access once but every membership is deactivated:
    // sign out and explain (a Server Component can't clear cookies itself).
    if ((memberships ?? []).length > 0) {
      redirect(`/api/auth/access-deactivated?locale=${locale}`)
    }
    redirect(`${localePrefix}/onboarding`)
  }

  const isOwner = restaurant.user_id === user.id
  if (restaurant.status === 'onboarding') {
    redirect(isOwner ? `${localePrefix}/onboarding` : `${localePrefix}/login`)
  }
  if (restaurant.status === 'pending_review') {
    redirect(isOwner ? `${localePrefix}/onboarding/submitted` : `${localePrefix}/login`)
  }
  if (restaurant.status === 'suspended' || restaurant.status === 'cancelled') {
    redirect(`${localePrefix}/login`)
  }

  let staff: DashboardStaff

  if (staffRow && staffRow.restaurant_id === restaurant.id) {
    staff = toDashboardStaff(staffRow)
    stampLastActive(staffRow.id, staffRow.last_active_at)
  } else if (isOwner) {
    // Belt-and-braces for a race with the D0.1 backfill: the owner always
    // gets in; the missing row is flagged for investigation.
    staff = {
      id: null,
      role: 'owner',
      display_name: user.email ?? 'Owner',
      language: locale,
    }
    void logMissingOwnerRow(restaurant.id, user.id)
  } else {
    redirect(`/api/auth/access-deactivated?locale=${locale}`)
  }

  // Page-level role gate: every dashboard page resolves its context first, so a
  // role that may not view this path is bounced BEFORE any data is fetched
  // (kitchen → the orders queue, everyone else → Today). The proxy sets
  // x-pathname on every request, including client-side navigations.
  const requestedPath = (await headers()).get('x-pathname')
  if (requestedPath) {
    const stripped = requestedPath.replace(/^\/(en|nl)(?=\/|$)/, '') || '/'
    if (stripped.startsWith('/dashboard') && !canViewPath(staff.role, stripped)) {
      redirect(`${localePrefix}${homePathFor(staff.role)}`)
    }
  }

  return {
    userId: user.id,
    userEmail: user.email ?? null,
    restaurant,
    staff,
  }
}

function toDashboardStaff(row: RestaurantStaffRow): DashboardStaff {
  return {
    id: row.id,
    role: row.role,
    display_name: row.display_name,
    language: row.language === 'en' ? 'en' : 'nl',
  }
}

async function logMissingOwnerRow(restaurantId: string, userId: string) {
  try {
    const admin = await createSupabaseServerClientAdmin()
    await admin.from('dashboard_audit_logs').insert({
      restaurant_id: restaurantId,
      staff_id: null,
      event_type: 'staff.missing_owner_row',
      event_data: { user_id: userId },
    })
  } catch (err) {
    console.error('[resolveDashboardContext] missing-owner-row audit failed', err)
  }
}

const LAST_ACTIVE_STAMP_INTERVAL_MS = 10 * 60 * 1000

/** Team page "last active": stamped at most once per 10 minutes, off the render path. */
function stampLastActive(staffId: string, lastActiveAt: string | null) {
  if (lastActiveAt && Date.now() - new Date(lastActiveAt).getTime() < LAST_ACTIVE_STAMP_INTERVAL_MS) return
  after(async () => {
    try {
      const admin = await createSupabaseServerClientAdmin()
      await admin.from('restaurant_staff').update({ last_active_at: new Date().toISOString() }).eq('id', staffId)
    } catch (err) {
      console.error('[resolveDashboardContext] last_active stamp failed', err)
    }
  })
}
