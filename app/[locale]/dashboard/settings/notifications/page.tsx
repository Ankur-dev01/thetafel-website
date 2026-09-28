import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { resolveDashboardContext } from '@/lib/dashboard/resolveDashboardContext'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import SectionHeader from '@/components/dashboard/ui/SectionHeader'
import NotificationsForm from './NotificationsForm'
import FailureHistory from './FailureHistory'

export const dynamic = 'force-dynamic'

type Params = { locale: string }

// The notify_* columns aren't in packages/db/types.ts yet (the migrations
// adding them are applied separately, after this code lands — same
// handoff as BTW-1/BTW-2). An explicit row type + generic override on
// .single() sidesteps the Database-generic column check so this compiles
// today and needs no changes once types.ts is regenerated. D5.6b added
// the three notify_restaurant_* columns (migration 025) and contact_email
// (already tracked) alongside D5.6a's four guest-facing columns.
type NotifyRow = {
  id: string
  notify_booking_confirmed: boolean
  notify_booking_cancelled: boolean
  notify_order_confirmed: boolean
  notify_order_ready: boolean
  notify_restaurant_new_booking: boolean
  notify_restaurant_new_order: boolean
  notify_restaurant_booking_cancelled: boolean
  contact_email: string | null
}

type FailureRow = {
  event_type: string
  event_data: Record<string, unknown> | null
  created_at: string
}

export default async function NotificationsSettingsPage({
  params,
}: {
  params: Promise<Params>
}) {
  const { locale: rawLocale } = await params
  const locale: 'nl' | 'en' = rawLocale === 'en' ? 'en' : 'nl'

  const context = await resolveDashboardContext(locale)

  // Owner-only — matches BTW-2's business page exactly.
  // resolveDashboardContext doesn't gate by role (hours/floor/etc. are
  // open to managers), so this page enforces it directly.
  if (context.staff.role !== 'owner') {
    redirect(locale === 'en' ? '/en/dashboard/settings' : '/dashboard/settings')
  }

  const supabase = await createSupabaseServerClient()

  const { data: r, error } = await supabase
    .from('restaurants')
    .select(
      'id, notify_booking_confirmed, notify_booking_cancelled, notify_order_confirmed, notify_order_ready, notify_restaurant_new_booking, notify_restaurant_new_order, notify_restaurant_booking_cancelled, contact_email'
    )
    .eq('id', context.restaurant.id)
    .single<NotifyRow>()

  if (error || !r) {
    throw new Error('failed to load notifications data')
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: failuresRaw } = await supabase
    .from('consumer_audit_logs')
    .select('event_type, event_data, created_at')
    .eq('restaurant_id', context.restaurant.id)
    .in('event_type', ['email.send_failed', 'whatsapp.send_failed'])
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: false })
    .limit(100)
    .returns<FailureRow[]>()

  const t = await getTranslations({ locale, namespace: 'dashboard.settings.notifications' })

  const changeLink = (
    <Link
      href="/dashboard/settings/business"
      className="underline"
      style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 500 }}
    >
      {t('restaurantNotifications.change')}
    </Link>
  )

  // Rendered server-side via t.rich so the email address can be bolded
  // without the client component needing its own i18n access.
  const restaurantEmailStatus = r.contact_email ? (
    <>
      {t.rich('restaurantNotifications.sentTo', {
        email: r.contact_email,
        b: (chunks) => <strong>{chunks}</strong>,
      })}{' '}
      {changeLink}
    </>
  ) : (
    <>
      {t('restaurantNotifications.noEmail')} {changeLink}
    </>
  )

  return (
    <div className="max-w-[640px]">
      <Link
        href="/dashboard/settings"
        className="text-[12px] uppercase tracking-[0.08em] text-[#8c8577]"
        style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
      >
        &larr; {t('back')}
      </Link>

      <SectionHeader title={t('title')} subtitle={t('subtitle')} />

      <FailureHistory
        failures={failuresRaw ?? []}
        labels={{
          sectionTitle: t('failures.title'),
          allDelivered: t('failures.allDelivered'),
          eventColumn: t('failures.eventColumn'),
          countColumn: t('failures.countColumn'),
          latestColumn: t('failures.latestColumn'),
          bookingConfirmedLabel: t('events.bookingConfirmed'),
          bookingCancelledLabel: t('events.bookingCancelled'),
          orderConfirmedLabel: t('events.orderConfirmed'),
          orderReadyLabel: t('events.orderReady'),
          magicLinkLabel: t('events.magicLink'),
          restaurantNewBookingLabel: t('events.restaurantNewBooking'),
          restaurantNewOrderLabel: t('events.restaurantNewOrder'),
          restaurantBookingCancelledLabel: t('events.restaurantBookingCancelled'),
          otherLabel: t('events.other'),
        }}
        locale={locale}
      />

      <NotificationsForm
        initial={{
          notify_booking_confirmed: r.notify_booking_confirmed,
          notify_booking_cancelled: r.notify_booking_cancelled,
          notify_order_confirmed: r.notify_order_confirmed,
          notify_order_ready: r.notify_order_ready,
          notify_restaurant_new_booking: r.notify_restaurant_new_booking,
          notify_restaurant_new_order: r.notify_restaurant_new_order,
          notify_restaurant_booking_cancelled: r.notify_restaurant_booking_cancelled,
        }}
        restaurantEmailStatus={restaurantEmailStatus}
        labels={{
          guestNotificationsSectionTitle: t('guestNotificationsSectionTitle'),
          guestNotificationsSectionDescription: t('guestNotificationsSectionDescription'),
          eventBookingConfirmed: t('eventBookingConfirmed'),
          eventBookingConfirmedDesc: t('eventBookingConfirmedDesc'),
          eventBookingCancelled: t('eventBookingCancelled'),
          eventBookingCancelledDesc: t('eventBookingCancelledDesc'),
          eventOrderConfirmed: t('eventOrderConfirmed'),
          eventOrderConfirmedDesc: t('eventOrderConfirmedDesc'),
          eventOrderReady: t('eventOrderReady'),
          eventOrderReadyDesc: t('eventOrderReadyDesc'),
          emailChannel: t('emailChannel'),
          whatsappChannel: t('whatsappChannel'),
          comingSoon: t('comingSoon'),
          offWarning: t('offWarning'),
          save: t('save'),
          saving: t('saving'),
          saved: t('saved'),
          saveError: t('saveError'),
          cancel: t('cancel'),
          restaurantNotificationsTitle: t('restaurantNotifications.title'),
          restaurantNotificationsDescription: t('restaurantNotifications.description'),
          restaurantEventNewBooking: t('restaurantNotifications.eventNewBooking'),
          restaurantEventNewBookingDesc: t('restaurantNotifications.eventNewBookingDesc'),
          restaurantEventNewOrder: t('restaurantNotifications.eventNewOrder'),
          restaurantEventNewOrderDesc: t('restaurantNotifications.eventNewOrderDesc'),
          restaurantEventBookingCancelled: t('restaurantNotifications.eventBookingCancelled'),
          restaurantEventBookingCancelledDesc: t('restaurantNotifications.eventBookingCancelledDesc'),
        }}
      />
    </div>
  )
}
