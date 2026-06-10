import { NextResponse } from 'next/server'
import {
  createSupabaseServerClient,
  createSupabaseServerClientAdmin,
} from '@/lib/supabase/server'
import {
  fetchOnboardingStatus,
  mapOnboardingStatus,
  getValidAccessTokenForRestaurant,
} from '@/lib/mollie/webhook'

export const runtime = 'nodejs'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, mollie_status, mollie_organization_id, mollie_access_token')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!restaurant) {
    return NextResponse.json({ error: 'restaurant_not_found' }, { status: 404 })
  }

  if (!restaurant.mollie_organization_id || !restaurant.mollie_access_token) {
    return NextResponse.json({ status: restaurant.mollie_status ?? 'not_started' })
  }

  if (restaurant.mollie_status === 'verified' || restaurant.mollie_status === 'rejected') {
    return NextResponse.json({ status: restaurant.mollie_status })
  }

  const admin = await createSupabaseServerClientAdmin()

  let accessToken: string
  try {
    accessToken = await getValidAccessTokenForRestaurant(admin, restaurant.id as string)
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('[mollie/kyc-status] token refresh failed:', err instanceof Error ? err.message : err)
    }
    return NextResponse.json({ status: restaurant.mollie_status ?? 'pending' })
  }

  let rawStatus: string | null
  try {
    rawStatus = await fetchOnboardingStatus(accessToken)
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('[mollie/kyc-status] onboarding fetch failed:', err instanceof Error ? err.message : err)
    }
    return NextResponse.json({ status: restaurant.mollie_status ?? 'pending' })
  }

  const mappedStatus = mapOnboardingStatus(rawStatus)

  if (mappedStatus !== restaurant.mollie_status) {
    const update: Record<string, unknown> = { mollie_status: mappedStatus }
    if (mappedStatus === 'verified') {
      update.mollie_verified_at = new Date().toISOString()
    }
    await admin.from('restaurants').update(update).eq('id', restaurant.id)

    try {
      await admin.from('audit_logs').insert({
        event_type: 'mollie.kyc_status_change',
        restaurant_id: restaurant.id,
        event_data: {
          from_status: restaurant.mollie_status,
          to_status: mappedStatus,
          raw_mollie_status: rawStatus,
          source: 'poll',
        },
      })
    } catch {
      // Audit failure must not break the response.
    }
  }

  return NextResponse.json({ status: mappedStatus })
}
