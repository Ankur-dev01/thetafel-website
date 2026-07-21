/**
 * Dashboard layout
 *
 * Wraps every /dashboard page in the responsive shell (dark sidebar + phone
 * tab bar + header). Auth guard, restaurant-status routing, and staff-
 * membership resolution live in resolveDashboardContext.
 */

import DashboardShell from '@/components/dashboard/shell/DashboardShell'
import { resolveDashboardContext } from '@/lib/dashboard/resolveDashboardContext'

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

  return (
    <DashboardShell locale={locale} context={context}>
      {children}
    </DashboardShell>
  )
}
