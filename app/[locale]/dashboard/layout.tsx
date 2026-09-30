/**
 * Dashboard layout
 *
 * Wraps every /dashboard page in the responsive shell (dark sidebar + phone
 * tab bar + header). Auth guard, restaurant-status routing, and staff-
 * membership resolution live in resolveDashboardContext.
 */

import DashboardShell from '@/components/dashboard/shell/DashboardShell'
import { resolveDashboardContext } from '@/lib/dashboard/resolveDashboardContext'
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'
import { suspensionDate } from '@/lib/billing/lifecycle'

export const dynamic = 'force-dynamic'

type Params = { locale: string }

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<Params>
}) {
  const { locale: rawLocale } = await params
  const locale: 'nl' | 'en' = rawLocale === 'en' ? 'en' : 'nl'

  const context = await resolveDashboardContext(locale)

  // Past-due subscription → amber banner on every page, with the date the
  // restaurant goes offline (grace start + 14 days). Best effort: a failed
  // lookup must never break the dashboard.
  let pastDueOfflineDate: string | null = null
  const graceStart = context.restaurant.grace_period_started_at
  if (graceStart) {
    try {
      const admin = await createSupabaseServerClientAdmin()
      const { data: sub } = await admin
        .from('subscriptions')
        .select('status')
        .eq('restaurant_id', context.restaurant.id)
        .eq('status', 'past_due')
        .maybeSingle()
      if (sub) {
        pastDueOfflineDate = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'nl-NL', {
          timeZone: 'Europe/Amsterdam',
          day: 'numeric',
          month: 'long',
        }).format(new Date(suspensionDate(graceStart)))
      }
    } catch (err) {
      console.error('[dashboard layout] past-due lookup failed', err)
    }
  }

  return (
    <DashboardShell locale={locale} context={context} pastDueOfflineDate={pastDueOfflineDate}>
      {children}
    </DashboardShell>
  )
}
