// POST /api/dashboard/billing/cancel
// Body: { reason: CancelReason, details?: string }
// Owner-only. Cancels the platform Mollie subscription FIRST; only on success
// sets subscriptions.cancelled_at + cancellation_reason. `status` is untouched
// (period-end handling is D6.5).

import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'
import { dashboardAudit } from '@/lib/dashboard/audit/dashboardAudit'
import { resolveMenuMutationContext } from '@/lib/dashboard/menu/resolveMenuMutationContext'
import { cancelSubscription, parseCancelInput } from '@/lib/dashboard/billing/billing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' } as const

const STATUS_BY_CODE = {
  no_subscription: 404,
  nothing_to_cancel: 409,
  already_cancelled: 409,
  mollie_failed: 502,
  db_error: 500,
} as const

export async function POST(req: NextRequest) {
  const resolved = await resolveMenuMutationContext('settings.billing.cancel')
  if (!resolved.ok) return resolved.response
  const { restaurant, staff } = resolved.ctx

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, code: 'invalid_body' }, { status: 400, headers: NO_STORE })
  }
  const input = parseCancelInput(body)
  if (!input) {
    return NextResponse.json({ ok: false, code: 'invalid_reason' }, { status: 400, headers: NO_STORE })
  }

  const admin = await createSupabaseServerClientAdmin()
  const result = await cancelSubscription({ admin, restaurantId: restaurant.id, input })

  if (!result.ok) {
    if (result.code === 'db_error') {
      // Mollie is already cancelled — leave a trail so it can be reconciled.
      await dashboardAudit({
        restaurantId: restaurant.id,
        staffId: staff.id,
        eventType: 'billing.subscription_cancel_db_failed',
        eventData: { reason: input.reason },
      })
    }
    return NextResponse.json(
      { ok: false, code: result.code },
      { status: STATUS_BY_CODE[result.code], headers: NO_STORE },
    )
  }

  await dashboardAudit({
    restaurantId: restaurant.id,
    staffId: staff.id,
    eventType: 'billing.subscription_cancelled',
    eventData: { reason: input.reason, subscriptionId: result.subscriptionId },
  })

  return NextResponse.json({ ok: true, endsOn: result.endsOn }, { headers: NO_STORE })
}
