// GET /api/auth/access-deactivated?locale=nl|en
// Landing point when a logged-in staff member's access was deactivated:
// signs the session out (a Server Component can't clear cookies) and sends
// them to /login with the "access deactivated" notice.

import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const locale = req.nextUrl.searchParams.get('locale') === 'en' ? 'en' : 'nl'
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  const prefix = locale === 'en' ? '/en' : ''
  return NextResponse.redirect(new URL(`${prefix}/login?deactivated=1`, req.url))
}
