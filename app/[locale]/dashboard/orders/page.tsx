import { getTranslations } from 'next-intl/server'
import { resolveDashboardContext } from '@/lib/dashboard/resolveDashboardContext'
import { getOrdersPayload, getOrderById } from '@/lib/dashboard/queries/orders'
import SectionHeader from '@/components/dashboard/ui/SectionHeader'
import OrdersClient from '@/components/dashboard/orders/OrdersClient'

export const dynamic = 'force-dynamic'

type Params = { locale: string }
type SearchParams = { type?: string; tab?: string; order?: string }

export default async function OrdersPage({
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

  const type = sp.type === 'qr' || sp.type === 'takeaway' ? sp.type : 'all'
  const tab = sp.tab === 'completed' ? 'completed' : 'active'
  const orderId = sp.order

  const [payload, selectedOrder] = await Promise.all([
    getOrdersPayload(context.restaurant.id),
    orderId ? getOrderById(context.restaurant.id, orderId) : Promise.resolve(null),
  ])

  const t = await getTranslations('dashboard.orders')

  return (
    <>
      <SectionHeader title={t('title')} />
      <OrdersClient
        initial={payload}
        restaurantId={context.restaurant.id}
        locale={locale}
        initialType={type}
        initialTab={tab}
        selectedOrder={selectedOrder}
      />
    </>
  )
}
