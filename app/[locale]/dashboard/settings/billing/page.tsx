import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { resolveDashboardContext } from '@/lib/dashboard/resolveDashboardContext'
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'
import SectionHeader from '@/components/dashboard/ui/SectionHeader'
import { formatEuros } from '@/lib/pricing/subscription'
import {
  PAYMENT_COLUMNS,
  SUBSCRIPTION_COLUMNS,
  daysUntil,
  fetchPaymentMethod,
  isVerificationCharge,
  splitGross,
  type PaymentMethodInfo,
  type PaymentRow,
  type SubscriptionRow,
} from '@/lib/dashboard/billing/billing'
import CancelSubscription from './CancelSubscription'

export const dynamic = 'force-dynamic'

type Params = { locale: string }

const labelStyle = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 } as const
const bodyStyle = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 } as const
const mutedStyle = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 300 } as const

const STATUS_COLOR: Record<string, string> = {
  trialing: '#d4820a',
  active: '#5fb46f',
  past_due: '#c64a4a',
  suspended: '#c64a4a',
  cancelled: '#8c8577',
}
const KNOWN_SUB_STATUS = ['trialing', 'active', 'past_due', 'suspended', 'cancelled']
const KNOWN_PAYMENT_STATUS = ['paid', 'pending', 'failed', 'expired', 'canceled']

export default async function BillingSettingsPage({ params }: { params: Promise<Params> }) {
  const { locale: rawLocale } = await params
  const locale: 'nl' | 'en' = rawLocale === 'en' ? 'en' : 'nl'

  const context = await resolveDashboardContext(locale)
  if (context.staff.role !== 'owner') {
    redirect(locale === 'en' ? '/en/dashboard/settings' : '/dashboard/settings')
  }

  const restaurantId = context.restaurant.id
  const admin = await createSupabaseServerClientAdmin()
  const [{ data: sub }, { data: paymentsRaw }] = await Promise.all([
    admin.from('subscriptions').select(SUBSCRIPTION_COLUMNS).eq('restaurant_id', restaurantId).maybeSingle<SubscriptionRow>(),
    admin
      .from('payments')
      .select(PAYMENT_COLUMNS)
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .limit(50)
      .returns<PaymentRow[]>(),
  ])
  const payments = paymentsRaw ?? []
  const method: PaymentMethodInfo = sub ? await fetchPaymentMethod(sub) : { state: 'none' }

  const t = await getTranslations({ locale, namespace: 'dashboard.settings.billing' })
  const dateFmt = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'nl-NL', {
    timeZone: 'Europe/Amsterdam',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const shortFmt = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'nl-NL', {
    timeZone: 'Europe/Amsterdam',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  const header = (
    <>
      <Link href="/dashboard/settings" className="text-[12px] uppercase tracking-[0.08em] text-[#8c8577]" style={labelStyle}>
        &larr; {t('back')}
      </Link>
      <SectionHeader title={t('title')} subtitle={t('subtitle')} />
    </>
  )

  if (!sub) {
    return (
      <div className="max-w-[640px]">
        {header}
        <section className="mt-6 bg-white rounded-card p-5" data-testid="billing-no-subscription">
          <p className="text-[14px] text-[#1e1508]" style={bodyStyle}>
            {t('noSubscription')}
          </p>
        </section>
      </div>
    )
  }

  const now = new Date()
  const isStarter = sub.tier === 'starter' || sub.monthly_amount_cents === 0
  const amounts = splitGross(sub.monthly_amount_cents, sub.vat_rate_bps)
  const statusKey = KNOWN_SUB_STATUS.includes(sub.status) ? sub.status : 'unknown'
  const trialDays = sub.status === 'trialing' ? daysUntil(sub.trial_ends_at, now) : null
  const endsOnIso = sub.current_period_end ?? sub.trial_ends_at
  const canCancel = !isStarter && !sub.cancelled_at && !!sub.mollie_subscription_id

  const methodText =
    method.state === 'ok'
      ? method.method === 'directdebit'
        ? `IBAN •••• ${method.last4 ?? '••••'}`
        : method.method === 'creditcard'
          ? `${method.brand ?? t('method.card')} •••• ${method.last4 ?? '••••'}`
          : method.method === 'paypal'
            ? 'PayPal'
            : t('method.other')
      : null

  return (
    <div className="max-w-[640px] pb-12">
      {header}

      <section className="mt-6 bg-white rounded-card p-5" data-testid="billing-plan-card">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[18px] text-[#1e1508]" style={labelStyle} data-testid="billing-plan-name">
            {t(`tier.${sub.tier}`)}
          </h2>
          <span
            data-testid="billing-status-chip"
            className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.08em] text-white"
            style={{ ...labelStyle, background: STATUS_COLOR[sub.status] ?? '#8c8577' }}
          >
            {t(`status.${statusKey}`)}
          </span>
        </div>

        <p className="mt-3 text-[22px] text-[#1e1508]" style={labelStyle} data-testid="billing-price">
          {isStarter ? t('free') : `${formatEuros(amounts.net, locale)} ${t('perMonthExVat')}`}
        </p>
        {!isStarter && (
          <p className="text-[12px] text-[#6f6353]" style={mutedStyle}>
            {t('inclVat', { amount: formatEuros(amounts.gross, locale) })}
          </p>
        )}

        {trialDays !== null && !sub.cancelled_at && (
          <p className="mt-3 text-[14px] text-[#1e1508]" style={bodyStyle} data-testid="billing-trial-countdown">
            {t('trialCountdown', {
              n: trialDays,
              price: `${formatEuros(amounts.net, locale)} ${t('exVatShort')}`,
            })}
          </p>
        )}

        {sub.cancelled_at && (
          <p className="mt-3 text-[14px] text-[#b3422f]" style={labelStyle} data-testid="billing-ends-on">
            {endsOnIso ? t('endsOn', { date: dateFmt.format(new Date(endsOnIso)) }) : t('endsSoon')}
          </p>
        )}

        {canCancel && (
          <div className="mt-5">
            <CancelSubscription
              labels={{
                button: t('cancel.button'),
                title: t('cancel.title'),
                statement: t('cancel.statement'),
                reasonLegend: t('cancel.reasonLegend'),
                reasons: {
                  too_expensive: t('cancel.reasons.too_expensive'),
                  missing_features: t('cancel.reasons.missing_features'),
                  closing_or_pausing: t('cancel.reasons.closing_or_pausing'),
                  switching_provider: t('cancel.reasons.switching_provider'),
                  other: t('cancel.reasons.other'),
                },
                detailsLabel: t('cancel.detailsLabel'),
                detailsRequired: t('cancel.detailsRequired'),
                reasonRequired: t('cancel.reasonRequired'),
                confirm: t('cancel.confirm'),
                working: t('cancel.working'),
                keep: t('cancel.keep'),
                errorGeneric: t('cancel.errorGeneric'),
                errorMollie: t('cancel.errorMollie'),
                errorAlready: t('cancel.errorAlready'),
              }}
            />
          </div>
        )}
      </section>

      {!isStarter && (
        <section className="mt-4 bg-white rounded-card p-5" data-testid="billing-method-card">
          <h2 className="text-[15px] text-[#1e1508]" style={labelStyle}>
            {t('method.title')}
          </h2>
          <p className="mt-2 text-[14px] text-[#1e1508]" style={bodyStyle} data-testid="billing-method">
            {method.state === 'ok'
              ? methodText
              : method.state === 'unavailable'
                ? t('method.unavailable')
                : t('method.none')}
          </p>
          <p className="mt-2 text-[12px] text-[#6f6353]" style={mutedStyle}>
            {t('method.change')}
          </p>
        </section>
      )}

      <section className="mt-4 bg-white rounded-card p-5" data-testid="billing-invoices-card">
        <h2 className="text-[15px] text-[#1e1508]" style={labelStyle}>
          {t('invoices.title')}
        </h2>
        {payments.length === 0 ? (
          <p className="mt-3 text-[13px] text-[#6f6353]" style={mutedStyle}>
            {t('invoices.empty')}
          </p>
        ) : (
          <table className="mt-4 w-full text-[13px]">
            <thead>
              <tr className="text-left text-[12px] text-[#8c8577] uppercase tracking-[0.06em]">
                <th className="py-2 font-medium">{t('invoices.date')}</th>
                <th className="py-2 font-medium">{t('invoices.description')}</th>
                <th className="py-2 font-medium text-right">{t('invoices.amount')}</th>
                <th className="py-2 font-medium">{t('invoices.status')}</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => {
                const downloadable = p.status === 'paid' && !!p.paid_at && !isVerificationCharge(p)
                const statusLabel = KNOWN_PAYMENT_STATUS.includes(p.status)
                  ? t(`invoices.statuses.${p.status}`)
                  : p.status
                return (
                  <tr key={p.id} className="border-t border-[#f0e8d6] align-top" data-testid="billing-payment-row">
                    <td className="py-2 pr-2 text-[#6f6353] whitespace-nowrap">
                      {shortFmt.format(new Date(p.paid_at ?? p.created_at))}
                    </td>
                    <td className="py-2 pr-2 text-[#1e1508]">
                      {p.description ?? '—'}
                      {p.invoice_number && (
                        <span className="block text-[12px] text-[#6f6353]" style={mutedStyle} data-testid="billing-invoice-number">
                          {p.invoice_number}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-2 text-right text-[#1e1508] whitespace-nowrap">
                      {formatEuros(p.amount_cents, locale)}
                    </td>
                    <td className="py-2 pr-2 text-[#1e1508]">{statusLabel}</td>
                    <td className="py-2 text-right">
                      {downloadable && (
                        <a
                          href={`/api/dashboard/billing/receipt/${p.id}?locale=${locale}`}
                          className="text-amber underline underline-offset-2"
                          data-testid="billing-pdf-link"
                        >
                          PDF
                        </a>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
