import { getTranslations } from 'next-intl/server'
import PlaceholderPage from '@/components/dashboard/shell/PlaceholderPage'

export const dynamic = 'force-dynamic'

export default async function OrdersPage() {
  const t = await getTranslations('dashboard.placeholder.orders')
  return <PlaceholderPage title={t('title')} subtitle={t('subtitle')} />
}
