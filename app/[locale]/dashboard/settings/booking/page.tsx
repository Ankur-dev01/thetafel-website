import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { resolveDashboardContext } from '@/lib/dashboard/resolveDashboardContext'
import { getBookingRulesInitialData } from '@/lib/dashboard/queries/bookingRules'
import SectionHeader from '@/components/dashboard/ui/SectionHeader'
import BookingRulesEditor from './BookingRulesEditor'

export const dynamic = 'force-dynamic'

type Params = { locale: string }

export default async function BookingRulesPage({ params }: { params: Promise<Params> }) {
  const { locale: rawLocale } = await params
  const locale: 'nl' | 'en' = rawLocale === 'en' ? 'en' : 'nl'

  const context = await resolveDashboardContext(locale)
  const t = await getTranslations('dashboard.settings.booking')

  const initialData = await getBookingRulesInitialData(context.restaurant.id)
  const restaurantName = context.restaurant.display_name ?? context.restaurant.name

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

      <BookingRulesEditor initialData={initialData} restaurantName={restaurantName} />
    </div>
  )
}
