import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { resolveDashboardContext } from '@/lib/dashboard/resolveDashboardContext'
import { parseCivilDateParam, amsterdamCivilDate } from '@/lib/dashboard/date/amsterdamDay'
import { getServiceWindowsForDay, getBookingsForDay, getBookingDetail } from '@/lib/dashboard/queries/bookings'
import SectionHeader from '@/components/dashboard/ui/SectionHeader'
import BookingsClient from '@/components/dashboard/bookings/BookingsClient'

export const dynamic = 'force-dynamic'

type Params = { locale: string }
type SearchParams = { date?: string; filter?: string; booking?: string }

export default async function BookingsPage({
  params,
  searchParams,
}: {
  params: Promise<Params>
  searchParams: Promise<SearchParams>
}) {
  const { locale: rawLocale } = await params
  const locale: 'nl' | 'en' = rawLocale === 'en' ? 'en' : 'nl'
  const localePrefix = locale === 'en' ? '/en' : ''

  const sp = await searchParams
  const context = await resolveDashboardContext(locale)

  const civilDate = parseCivilDateParam(sp.date)
  if (sp.date && civilDate === null) {
    redirect(`${localePrefix}/dashboard/bookings`)
  }
  const effectiveDate = civilDate ?? amsterdamCivilDate(new Date())

  const [windows, bookings, selectedBookingDetail] = await Promise.all([
    getServiceWindowsForDay(context.restaurant.id, effectiveDate),
    getBookingsForDay(context.restaurant.id, effectiveDate),
    sp.booking ? getBookingDetail(context.restaurant.id, sp.booking) : Promise.resolve(null),
  ])

  const t = await getTranslations('dashboard.bookings')

  return (
    <>
      <SectionHeader title={t('title')} />
      <BookingsClient
        civilDate={effectiveDate}
        windows={windows}
        bookings={bookings}
        selectedBookingDetail={selectedBookingDetail}
        locale={locale}
      />
    </>
  )
}
