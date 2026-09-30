// POST /api/dashboard/account/language   Body: { locale: 'nl' | 'en' }
// Writes restaurant_staff.language (own row) and profiles.locale.

import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'
import { dashboardAudit } from '@/lib/dashboard/audit/dashboardAudit'
import { resolveAccountContext, NO_STORE } from '@/lib/dashboard/account/resolveAccountContext'
import { parseLocale } from '@/lib/dashboard/account/accountValidation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const resolved = await resolveAccountContext()
  if (!resolved.ok) return resolved.response
  const { user, restaurantId, staff } = resolved.ctx

  let body: { locale?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, code: 'invalid_body' }, { status: 400, headers: NO_STORE })
  }

  const locale = parseLocale(body.locale)
  if (!locale) {
    return NextResponse.json({ ok: false, code: 'invalid_locale' }, { status: 400, headers: NO_STORE })
  }

  const admin = await createSupabaseServerClientAdmin()
  const [staffRes, profileRes] = await Promise.all([
    admin
      .from('restaurant_staff')
      .update({ language: locale })
      .eq('restaurant_id', restaurantId)
      .eq('user_id', user.id),
    admin.from('profiles').update({ locale }).eq('id', user.id),
  ])
  if (staffRes.error || profileRes.error) {
    console.error('[account/language] update failed', staffRes.error?.message, profileRes.error?.message)
    return NextResponse.json({ ok: false, code: 'db_error' }, { status: 500, headers: NO_STORE })
  }

  await dashboardAudit({
    restaurantId,
    staffId: staff.id,
    eventType: 'staff.profile_updated',
    eventData: { fields: ['language'], language: locale },
  })

  return NextResponse.json({ ok: true, locale }, { headers: NO_STORE })
}
