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

// The four notify_* columns aren't in packages/db/types.ts yet (the
// migration adding them is applied separately, after this code lands —
// same handoff as BTW-1/BTW-2). An explicit row type + generic override
// on .single() sidesteps the Database-generic column check so this
// compiles today and needs no changes once types.ts is regenerated.
type NotifyRow = {
  id: string
  notify_booking_confirmed: boolean
  notify_booking_cancelled: boolean
  notify_order_confirmed: boolean
  notify_order_ready: boolean
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
    .select('id, notify_booking_confirmed, notify_booking_cancelled, notify_order_confirmed, notify_order_ready')
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
        }}
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
        }}
      />

      {/* Restaurant-facing placeholder — D5.6b builds the real thing */}
      <section className="mt-4 bg-white rounded-card p-5">
        <h2
          className="text-[15px] text-[#1e1508]"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
        >
          {t('restaurantNotifications.title')}
        </h2>
        <p
          className="mt-2 text-[13px] text-[#6f6353] leading-relaxed"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 300 }}
        >
          {t('restaurantNotifications.comingSoon')}
        </p>
      </section>
    </div>
  )
}
