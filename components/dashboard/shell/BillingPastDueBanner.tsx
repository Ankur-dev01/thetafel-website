import { Link } from '@/i18n/routing'

/**
 * Amber strip shown on every dashboard page while the subscription is
 * `past_due` (a recurring charge failed and the grace clock is running).
 * Server component — the layout resolves the date.
 */

type Props = {
  locale: 'nl' | 'en'
  /** Date (Amsterdam) the restaurant goes offline: grace start + 14 days. */
  offlineDate: string
}

export default function BillingPastDueBanner({ locale, offlineDate }: Props) {
  const text =
    locale === 'en'
      ? `Your payment failed. Your restaurant goes offline for guests on ${offlineDate}.`
      : `Je betaling is mislukt. Je restaurant gaat op ${offlineDate} offline voor gasten.`
  const action = locale === 'en' ? 'Go to billing' : 'Naar facturatie'

  return (
    <div
      role="status"
      data-testid="billing-past-due-banner"
      className="mb-4 bg-[#fcf0d8] rounded-card p-4 flex items-center gap-4"
    >
      <p
        className="flex-1 min-w-0 text-[14px] text-[#1e1508]"
        style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 500 }}
      >
        {text}
      </p>
      <Link
        href="/dashboard/settings/billing"
        className="tafel-tap flex-shrink-0 px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-amber text-[#1e1508]"
        style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
      >
        {action}
      </Link>
    </div>
  )
}
