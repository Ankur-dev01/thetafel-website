import { getTranslations } from 'next-intl/server'
import { resolveDashboardContext } from '@/lib/dashboard/resolveDashboardContext'
import { getMenuCategories, getMenuPayload, getMenuItemDetail } from '@/lib/dashboard/queries/menu'
import SectionHeader from '@/components/dashboard/ui/SectionHeader'
import MenuClient from '@/components/dashboard/menu/MenuClient'

export const dynamic = 'force-dynamic'

type Params = { locale: string }
type SearchParams = { category?: string; item?: string; q?: string }

export default async function MenuPage({
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

  const search = sp.q?.trim() ?? ''
  const categories = await getMenuCategories(context.restaurant.id, locale)

  // Explicit ?category wins. With no category param: search scopes to every
  // category (global search), plain browsing defaults to the first category
  // by display_order. An unknown category id falls back the same way a
  // missing one does — the query below simply returns zero rows for it.
  let activeCategoryId: string | null = null
  if (sp.category && categories.some((c) => c.id === sp.category)) {
    activeCategoryId = sp.category
  } else if (!search && categories.length > 0) {
    activeCategoryId = categories[0].id
  }

  const [payload, selectedItem] = await Promise.all([
    getMenuPayload(context.restaurant.id, locale, {
      categoryId: activeCategoryId ?? undefined,
      search: search || undefined,
    }),
    sp.item ? getMenuItemDetail(context.restaurant.id, sp.item, locale) : Promise.resolve(null),
  ])

  const t = await getTranslations('dashboard.menu')

  return (
    <>
      <SectionHeader title={t('title')} subtitle={t('subtitle', { items: payload.totals.items, categories: payload.totals.categories })} />
      <MenuClient
        categories={payload.categories}
        items={payload.items}
        unavailableCount={payload.totals.unavailable}
        activeCategoryId={activeCategoryId}
        search={search}
        selectedItem={selectedItem}
        locale={locale}
      />
    </>
  )
}
