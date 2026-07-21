import 'server-only'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import {
  createSupabaseServerClient,
  createSupabaseServerClientAdmin,
} from '@/lib/supabase/server'
import type { Database } from '@/packages/db/types'
import type { StaffRole } from '@/lib/dashboard/nav'

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

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('*')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!restaurant) {
    redirect(`${localePrefix}/onboarding`)
  }
  if (restaurant.status === 'onboarding') {
    redirect(`${localePrefix}/onboarding`)
  }
  if (restaurant.status === 'pending_review') {
    redirect(`${localePrefix}/onboarding/submitted`)
  }
  if (restaurant.status === 'suspended' || restaurant.status === 'cancelled') {
    redirect(`${localePrefix}/login`)
  }

  const { data: staffRow } = await supabase
    .from('restaurant_staff')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .eq('user_id', user.id)
    .is('deactivated_at', null)
    .maybeSingle()

  let staff: DashboardStaff

  if (staffRow) {
    staff = toDashboardStaff(staffRow)
  } else if (restaurant.user_id === user.id) {
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
    redirect(`${localePrefix}/login`)
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
