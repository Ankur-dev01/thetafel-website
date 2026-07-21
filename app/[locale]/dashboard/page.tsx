import { resolveDashboardContext } from '@/lib/dashboard/resolveDashboardContext'
import { getTodayPayload } from '@/lib/dashboard/queries/today'
import AlertStripStub from '@/components/dashboard/today/AlertStripStub'
import TodayClient from '@/components/dashboard/today/TodayClient'

export const dynamic = 'force-dynamic'

type Params = { locale: string }

export default async function TodayPage({ params }: { params: Promise<Params> }) {
  const { locale: rawLocale } = await params
  const locale: 'nl' | 'en' = rawLocale === 'en' ? 'en' : 'nl'

  const context = await resolveDashboardContext(locale)
  const now = new Date()
  const payload = await getTodayPayload(context.restaurant.id, now)

  return (
    <>
      <AlertStripStub />
      <TodayClient initial={payload} restaurantId={context.restaurant.id} locale={locale} />
    </>
  )
}
