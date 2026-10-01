// GET /api/dashboard/guests/export?locale=nl|en   (guests.export — owner/manager; Plus+)
// CSV of THIS restaurant's guests (anonymised excluded). Audited with the row
// count only. 10 exports per restaurant per day.

import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'
import { resolveFeatureContext, NO_STORE } from '@/lib/dashboard/guests/guard'
import { listAllGuests } from '@/lib/dashboard/guests/guests'
import { buildGuestCsv, type GuestCsvLabels } from '@/lib/dashboard/guests/csv'
import { dashboardAudit } from '@/lib/dashboard/audit/dashboardAudit'
import { tierAtLeast } from '@/lib/dashboard/tier'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EXPORTS_PER_DAY = 10

const LABELS: Record<'nl' | 'en', GuestCsvLabels> = {
  nl: {
    name: 'Naam', email: 'E-mail', phone: 'Telefoon', visits: 'Bezoeken', lastVisit: 'Laatste bezoek',
    totalSpend: 'Totaal besteed (EUR)', marketingConsent: 'Marketingtoestemming', marketingConsentDate: 'Toestemming sinds',
    vip: 'VIP', yes: 'ja', no: 'nee',
  },
  en: {
    name: 'Name', email: 'Email', phone: 'Phone', visits: 'Visits', lastVisit: 'Last visit',
    totalSpend: 'Total spend (EUR)', marketingConsent: 'Marketing consent', marketingConsentDate: 'Consent since',
    vip: 'VIP', yes: 'yes', no: 'no',
  },
}

export async function GET(req: NextRequest) {
  const resolved = await resolveFeatureContext('guests.export', 'plus', { write: true })
  if (!resolved.ok) return resolved.response
  const { restaurantId, staff, tier } = resolved.ctx

  const admin = await createSupabaseServerClientAdmin()
  const since = new Date(Date.now() - 24 * 3600_000).toISOString()
  const { count } = await admin
    .from('dashboard_audit_logs')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)
    .eq('event_type', 'guests.exported')
    .gte('created_at', since)
  if ((count ?? 0) >= EXPORTS_PER_DAY) {
    return NextResponse.json({ ok: false, code: 'rate_limited' }, { status: 429, headers: { ...NO_STORE, 'Retry-After': '3600' } })
  }

  const locale: 'nl' | 'en' = req.nextUrl.searchParams.get('locale') === 'en' ? 'en' : 'nl'
  const guests = await listAllGuests(restaurantId)
  const includeVip = tierAtLeast(tier, 'premium')
  const csv = buildGuestCsv(guests, LABELS[locale], { includeVip })

  const { data: r } = await admin.from('restaurants').select('slug').eq('id', restaurantId).maybeSingle<{ slug: string }>()
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date())
  const filename = `gasten-${(r?.slug ?? 'restaurant').replace(/[^a-z0-9_-]/gi, '')}-${day}.csv`

  await dashboardAudit({
    restaurantId,
    staffId: staff.id,
    eventType: 'guests.exported',
    eventData: { rows: guests.length },
  })

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'X-Row-Count': String(guests.length),
      'Access-Control-Expose-Headers': 'X-Row-Count, Content-Disposition',
      'Cache-Control': 'private, no-store',
    },
  })
}
