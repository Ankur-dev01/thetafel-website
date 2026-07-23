import { resolveDashboardContext } from '@/lib/dashboard/resolveDashboardContext'
import { getTodayPayload, amsterdamCivilDate } from '@/lib/dashboard/queries/today'
import TodayClient from '@/components/dashboard/today/TodayClient'
import PauseBanner from '@/components/dashboard/today/PauseBanner'
import TodayErrorState from '@/components/dashboard/today/TodayErrorState'
import type { TodayPayload } from '@/lib/dashboard/queries/today'

export const dynamic = 'force-dynamic'

type Params = { locale: string }

export default async function TodayPage({ params }: { params: Promise<Params> }) {
  const { locale: rawLocale } = await params
  const locale: 'nl' | 'en' = rawLocale === 'en' ? 'en' : 'nl'

  const context = await resolveDashboardContext(locale)
  const now = new Date()

  let payload: TodayPayload | null = null
  try {
    payload = await getTodayPayload(context.restaurant.id, now, context.staff.role)
  } catch (err) {
    console.error('[TodayPage] getTodayPayload failed', err)
  }

  const { paused_at: pausedAt, pause_reason: pauseReason } = context.restaurant

  return (
    <>
      {pausedAt !== null && (
        <div className="pt-4">
          <PauseBanner
            pausedAt={pausedAt}
            pauseReason={(pauseReason as 'manual' | 'billing_suspended' | null) ?? 'manual'}
          />
        </div>
      )}
      {payload === null ? (
        <TodayErrorState />
      ) : (
        <TodayClient
          initial={payload}
          restaurantId={context.restaurant.id}
          locale={locale}
          todayAmsterdamCivilDate={amsterdamCivilDate(now)}
        />
      )}
    </>
  )
}
