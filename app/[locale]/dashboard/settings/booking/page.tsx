import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { resolveDashboardContext } from '@/lib/dashboard/resolveDashboardContext'
import { getBookingRulesInitialData } from '@/lib/dashboard/queries/bookingRules'
import SectionHeader from '@/components/dashboard/ui/SectionHeader'
import BookingRulesEditor from './BookingRulesEditor'

export const dynamic = 'force-dynamic'

type Params = { locale: string }

function buildAddress(restaurant: {
  legal_address_street: string | null
  legal_address_house_number: string | null
  legal_address_house_letter: string | null
  legal_address_house_number_addition: string | null
  legal_address_postcode: string | null
  legal_address_city: string | null
}): string {
  const houseNumber = [
    restaurant.legal_address_house_number,
    restaurant.legal_address_house_letter,
    restaurant.legal_address_house_number_addition,
  ]
    .filter(Boolean)
    .join('')
  const line1 = [restaurant.legal_address_street, houseNumber].filter(Boolean).join(' ')
  const line2 = [restaurant.legal_address_postcode, restaurant.legal_address_city].filter(Boolean).join(' ')
  return [line1, line2].filter(Boolean).join(', ')
}

export default async function BookingRulesPage({ params }: { params: Promise<Params> }) {
  const { locale: rawLocale } = await params
  const locale: 'nl' | 'en' = rawLocale === 'en' ? 'en' : 'nl'

  const context = await resolveDashboardContext(locale)
  const t = await getTranslations('dashboard.settings.booking')

  const initialData = await getBookingRulesInitialData(context.restaurant.id)
  const restaurantName = context.restaurant.display_name ?? context.restaurant.name
  const restaurantAddress = buildAddress(context.restaurant)

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

      <BookingRulesEditor initialData={initialData} restaurantName={restaurantName} restaurantAddress={restaurantAddress} />
    </div>
  )
}
