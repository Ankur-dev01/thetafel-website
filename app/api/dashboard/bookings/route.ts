// app/api/dashboard/bookings/route.ts
//
// GET /api/dashboard/bookings?date=YYYY-MM-DD → 200 BookingsDayPayload | 401 | 403
//
// Session-authenticated; called by usePolling so the Bookings list picks up
// new/changed reservations without a manual refresh (same pattern as D3.1's
// /api/dashboard/orders and D3.4's /api/dashboard/tabs — this list never got
// its own polling route in D2.1). Read-only, RLS-scoped throughout. No rate
// limit needed. Missing/invalid `date` falls back to "today" in
// Europe/Amsterdam, matching the page's own default.

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getServiceWindowsForDay, getBookingsForDay } from '@/lib/dashboard/queries/bookings'
import { parseCivilDateParam, amsterdamCivilDate } from '@/lib/dashboard/date/amsterdamDay'

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: 'not_authenticated' },
      { status: 401, headers: { 'Cache-Control': 'private, no-store' } },
    )
  }

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!restaurant) {
    return NextResponse.json(
      { error: 'not_staff' },
      { status: 403, headers: { 'Cache-Control': 'private, no-store' } },
    )
  }

  const rawDate = req.nextUrl.searchParams.get('date')
  const civilDate = parseCivilDateParam(rawDate) ?? amsterdamCivilDate(new Date())

  const [windows, bookings] = await Promise.all([
    getServiceWindowsForDay(restaurant.id, civilDate),
    getBookingsForDay(restaurant.id, civilDate),
  ])

  return NextResponse.json(
    { civilDate, windows, bookings },
    { status: 200, headers: { 'Cache-Control': 'private, no-store' } },
  )
}
