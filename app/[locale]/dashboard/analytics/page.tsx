import { getTranslations } from 'next-intl/server'
import PlaceholderPage from '@/components/dashboard/shell/PlaceholderPage'

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage() {
  const t = await getTranslations('dashboard.placeholder.analytics')
  return <PlaceholderPage title={t('title')} subtitle={t('subtitle')} />
}
