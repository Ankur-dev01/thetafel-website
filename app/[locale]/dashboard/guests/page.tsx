import { getTranslations } from 'next-intl/server'
import { resolveDashboardContext } from '@/lib/dashboard/resolveDashboardContext'
import { can } from '@/lib/dashboard/permissions'
import { getRestaurantTier, tierAtLeast } from '@/lib/dashboard/tier'
import { getGuestDetail, listGuests } from '@/lib/dashboard/guests/guests'
import SectionHeader from '@/components/dashboard/ui/SectionHeader'
import GuestsView from '@/components/dashboard/guests/GuestsView'
import GuestsTeaser from '@/components/dashboard/guests/GuestsTeaser'

export const dynamic = 'force-dynamic'

type SearchParams = { q?: string; guest?: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function GuestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<SearchParams>
}) {
  const { locale: rawLocale } = await params
  const { q = '', guest: guestParam } = await searchParams
  const locale: 'nl' | 'en' = rawLocale === 'en' ? 'en' : 'nl'

  // Role gate runs inside resolveDashboardContext (kitchen is bounced there).
  const context = await resolveDashboardContext(locale)
  const role = context.staff.role
  const tier = await getRestaurantTier(context.restaurant.id)
  const t = await getTranslations({ locale, namespace: 'dashboard.guests' })

  const header = <SectionHeader title={t('title')} subtitle={t('subtitle')} />

  // Starter: teaser only — no guest data is queried at all.
  if (!tierAtLeast(tier, 'plus')) {
    return (
      <div className="max-w-[880px] pb-12">
        {header}
        <GuestsTeaser locale={locale} isOwner={role === 'owner'} />
      </div>
    )
  }

  const search = q.slice(0, 80)
  const [list, initialGuest] = await Promise.all([
    listGuests(context.restaurant.id, { search }),
    guestParam && UUID.test(guestParam) && can(role, 'guests.read')
      ? getGuestDetail(context.restaurant.id, guestParam)
      : Promise.resolve(null),
  ])
  const premium = tierAtLeast(tier, 'premium')
  const rows = premium ? list.rows : list.rows.map((r) => ({ ...r, vip: false }))

  return (
    <div className="max-w-[880px] pb-12">
      {header}
      <GuestsView
        locale={locale}
        initialQuery={search}
        initialList={{ ...list, rows }}
        initialGuest={initialGuest ? { ...initialGuest, vip: premium ? initialGuest.vip : false } : null}
        canEditNote={can(role, 'guests.note.edit')}
        canToggleVip={premium && can(role, 'guests.vip.toggle')}
        showVip={premium}
        canExport={can(role, 'guests.export')}
      />
    </div>
  )
}
