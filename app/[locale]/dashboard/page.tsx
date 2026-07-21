import { resolveDashboardContext } from '@/lib/dashboard/resolveDashboardContext'
import { getTodayPayload, amsterdamCivilDate } from '@/lib/dashboard/queries/today'
import TodayClient from '@/components/dashboard/today/TodayClient'

export const dynamic = 'force-dynamic'

type Params = { locale: string }

export default async function TodayPage({ params }: { params: Promise<Params> }) {
  const { locale: rawLocale } = await params
  const locale: 'nl' | 'en' = rawLocale === 'en' ? 'en' : 'nl'

  const context = await resolveDashboardContext(locale)
  const now = new Date()
  const payload = await getTodayPayload(context.restaurant.id, now, context.staff.role)

  return (
    <TodayClient
      initial={payload}
      restaurantId={context.restaurant.id}
      locale={locale}
      todayAmsterdamCivilDate={amsterdamCivilDate(now)}
    />
  )
}
