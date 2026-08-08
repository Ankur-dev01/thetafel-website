import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { resolveDashboardContext } from '@/lib/dashboard/resolveDashboardContext'
import { getHoursEditorInitialData } from '@/lib/dashboard/queries/availability'
import SectionHeader from '@/components/dashboard/ui/SectionHeader'
import HoursEditor from './HoursEditor'

export const dynamic = 'force-dynamic'

type Params = { locale: string }

export default async function HoursSettingsPage({ params }: { params: Promise<Params> }) {
  const { locale: rawLocale } = await params
  const locale: 'nl' | 'en' = rawLocale === 'en' ? 'en' : 'nl'

  const context = await resolveDashboardContext(locale)
  const t = await getTranslations('dashboard.settings.hours')

  const initialData = await getHoursEditorInitialData(context.restaurant.id, context.restaurant.slug)

  return (
    <div className="max-w-[760px]">
      <Link
        href="/dashboard/settings"
        className="text-[12px] uppercase tracking-[0.08em] text-[#8c8577]"
        style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
      >
        &larr; {t('back')}
      </Link>

      <SectionHeader title={t('title')} subtitle={t('subtitle')} />

      <HoursEditor initialData={initialData} />
    </div>
  )
}
