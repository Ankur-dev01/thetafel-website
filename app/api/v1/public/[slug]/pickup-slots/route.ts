// app/api/v1/public/[slug]/pickup-slots/route.ts
//
// GET /api/v1/public/{slug}/pickup-slots
//
// Returns the list of pickup slots for today (open_now) or the next opening
// window (closed_today) for the takeaway flow. Read-only, cheap, rate-limited
// via the menu_view key (generous enough for a picker that fetches once on
// page load).
//
// If the restaurant is unavailable for takeaway right now, returns
// { available: false, reason } — the client renders a friendly state and
// offers no Continue button.

import { NextResponse, type NextRequest } from 'next/server'
import { checkConsumerRateLimit, getCallerIp } from '@/lib/consumer/rateLimit'
import { resolveRestaurantBySlug } from '@/lib/consumer/resolveRestaurant'
import { computeTakeawayOpeningWindow } from '@/lib/takeaway/openingWindow'
import { computePickupSlots } from '@/lib/takeaway/computePickupSlots'
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const ip = getCallerIp(req)

  const rl = await checkConsumerRateLimit('menu_view', ip)
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds ?? 60) } },
    )
  }

  // resolveRestaurantBySlug already filters status='live' internally — a
  // non-null result here is always a live restaurant (see C6.1).
  const restaurant = await resolveRestaurantBySlug(slug)
  if (!restaurant) {
    return NextResponse.json({ ok: false, error: 'restaurant_not_found' }, { status: 404 })
  }

  const window = await computeTakeawayOpeningWindow(restaurant.id)

  if (window.status === 'unavailable') {
    return NextResponse.json({
      ok: true,
      available: false,
      reason: window.reason,
    })
  }

  const admin = await createSupabaseServerClientAdmin()

  // Additional config the API needs but computeTakeawayOpeningWindow doesn't return.
  const { data: cfgRow } = await admin
    .from('restaurants')
    .select('kitchen_closes_offset_minutes, takeaway_scheduled_orders_allowed')
    .eq('id', restaurant.id)
    .maybeSingle()

  const kitchenClosesOffsetMinutes = cfgRow?.kitchen_closes_offset_minutes ?? 30
  const scheduledAllowed = !!cfgRow?.takeaway_scheduled_orders_allowed

  // Which window are we generating slots for? computePickupSlots rounds
  // slot boundaries relative to windowOpenInstant, so it must be a clean
  // clock mark (today's actual service-open time) — passing "now" here
  // would offset every slot by today's arbitrary seconds/milliseconds.
  const nowIso = new Date().toISOString()
  const windowOpenInstant = window.status === 'open_now' ? window.todayOpenInstant : window.nextOpenInstant
  const windowCloseInstant =
    window.status === 'open_now' ? window.todayCloseInstant : window.nextCloseInstant
  const prepTimeMinutes = window.prepTimeMinutes
  const slotIntervalMinutes = window.slotIntervalMinutes

  // Backlog: count of confirmed takeaway orders bucketed by pickup_time.
  // Only relevant for open_now; for closed_today, backlog is trivially zero
  // (this window hasn't started yet).
  const backlogByInstant: Record<string, number> = {}
  if (window.status === 'open_now') {
    const { data: backlogRows, error: bErr } = await admin
      .from('orders')
      .select('pickup_time')
      .eq('restaurant_id', restaurant.id)
      .eq('order_type', 'takeaway')
      .in('status', ['confirmed', 'preparing', 'ready'])
      .gte('pickup_time', windowOpenInstant)
      .lte('pickup_time', windowCloseInstant)
    if (bErr) {
      console.error('[pickup-slots] backlog query failed', bErr.message)
    }
    for (const row of backlogRows ?? []) {
      if (!row.pickup_time) continue
      const iso = new Date(row.pickup_time).toISOString()
      backlogByInstant[iso] = (backlogByInstant[iso] ?? 0) + 1
    }
  }

  const engine = computePickupSlots({
    windowOpenInstant,
    windowCloseInstant,
    nowInstant: nowIso,
    prepTimeMinutes,
    slotIntervalMinutes,
    kitchenClosesOffsetMinutes,
    // Gap: no per-slot cap column in schema yet (see phase-2 ledger —
    // Phase 3 / C9 hardening item). Ship with no cap; backlog is still
    // computed and returned so the wiring is ready to consume one.
    maxOrdersPerSlot: Number.POSITIVE_INFINITY,
    backlogByInstant,
  })

  if (engine.slots.length === 0) {
    return NextResponse.json({
      ok: true,
      available: false,
      reason: 'no_slots_available',
    })
  }

  return NextResponse.json(
    {
      ok: true,
      available: true,
      windowStatus: window.status,
      scheduledAllowed,
      windowOpenInstant,
      windowCloseInstant,
      slots: engine.slots,
      earliestPickupInstant: engine.earliestPickupInstant,
      latestPickupInstant: engine.latestPickupInstant,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
