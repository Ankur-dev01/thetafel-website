import { getTranslations } from 'next-intl/server'
import PlaceholderPage from '@/components/dashboard/shell/PlaceholderPage'

export const dynamic = 'force-dynamic'

export default async function GuestsPage() {
  const t = await getTranslations('dashboard.placeholder.guests')
  return <PlaceholderPage title={t('title')} subtitle={t('subtitle')} />
}
