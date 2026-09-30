// POST /api/auth/logout — ends THIS device's session (scope local). "Log out
// everywhere" lives on the account page (/api/dashboard/account/signout-all).

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut({ scope: 'local' })
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}
