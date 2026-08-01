import { getTranslations } from 'next-intl/server'
import { resolveDashboardContext } from '@/lib/dashboard/resolveDashboardContext'
import { getTabsPayload, getTabById } from '@/lib/dashboard/queries/tabs'
import SectionHeader from '@/components/dashboard/ui/SectionHeader'
import TabsClient from '@/components/dashboard/tabs/TabsClient'
import type { TabFilter } from '@/components/dashboard/tabs/TabFilterChips'

export const dynamic = 'force-dynamic'

type Params = { locale: string }
type SearchParams = { filter?: string; tab?: string }

export default async function TabsPage({
  params,
  searchParams,
}: {
  params: Promise<Params>
  searchParams: Promise<SearchParams>
}) {
  const { locale: rawLocale } = await params
  const locale: 'nl' | 'en' = rawLocale === 'en' ? 'en' : 'nl'

  const sp = await searchParams
  const context = await resolveDashboardContext(locale)

  const filter: TabFilter = sp.filter === 'stale' ? 'stale' : 'all'
  const tabId = sp.tab

  const [payload, selectedTab] = await Promise.all([
    getTabsPayload(context.restaurant.id),
    tabId ? getTabById(context.restaurant.id, tabId) : Promise.resolve(null),
  ])

  const t = await getTranslations('dashboard.tabs')

  return (
    <>
      <SectionHeader title={t('title')} />
      <TabsClient initial={payload} locale={locale} initialFilter={filter} selectedTab={selectedTab} />
    </>
  )
}
