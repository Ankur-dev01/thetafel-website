import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { resolveDashboardContext } from '@/lib/dashboard/resolveDashboardContext'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import SectionHeader from '@/components/dashboard/ui/SectionHeader'

export const dynamic = 'force-dynamic'

type Params = { locale: string }
type SearchParams = { page?: string }

const PAGE_SIZE = 50

type Row = {
  id: string
  event_type: string
  event_data: { requestReference?: string; reason?: string } | null
  created_at: string
}

const labelStyle = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 } as const
const bodyStyle = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 } as const
const mutedStyle = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 300 } as const

const KNOWN_REASONS = ['upcoming_booking', 'active_order', 'payment_in_flight'] as const

export default async function PrivacySettingsPage({
  params,
  searchParams,
}: {
  params: Promise<Params>
  searchParams: Promise<SearchParams>
}) {
  const { locale: rawLocale } = await params
  const { page: rawPage } = await searchParams
  const locale: 'nl' | 'en' = rawLocale === 'en' ? 'en' : 'nl'

  const context = await resolveDashboardContext(locale)

  // Owner + manager. (Managers don't exist yet — the check is here so it's
  // already correct when they do.)
  if (context.staff.role !== 'owner' && context.staff.role !== 'manager') {
    redirect(locale === 'en' ? '/en/dashboard/settings' : '/dashboard/settings')
  }

  const page = Math.max(1, Number.parseInt(rawPage ?? '1', 10) || 1)
  const from = (page - 1) * PAGE_SIZE
  const since = new Date()
  since.setFullYear(since.getFullYear() - 1)

  // Only the per-restaurant fan-out rows (written by the guest privacy routes).
  // Selects no guest id, IP or user agent — nothing identifying leaves the DB.
  const supabase = await createSupabaseServerClient()
  const { data, count, error } = await supabase
    .from('consumer_audit_logs')
    .select('id, event_type, event_data, created_at', { count: 'exact' })
    .eq('restaurant_id', context.restaurant.id)
    .in('event_type', [
      'privacy.data_export_completed',
      'privacy.data_deletion_completed',
      'privacy.data_deletion_blocked',
    ])
    .eq('event_data->>fanout', 'true')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1)
    .returns<Row[]>()

  if (error) throw new Error('failed to load privacy requests')

  const rows = data ?? []
  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const t = await getTranslations({ locale, namespace: 'dashboard.settings.privacy' })
  const fmt = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'nl-NL', {
    timeZone: 'Europe/Amsterdam',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  const typeLabel = (eventType: string) =>
    eventType === 'privacy.data_export_completed' ? t('type.export') : t('type.deletion')

  const statusLabel = (r: Row) => {
    if (r.event_type !== 'privacy.data_deletion_blocked') return t('status.completed')
    const reason = r.event_data?.reason
    const known = (KNOWN_REASONS as readonly string[]).includes(reason ?? '')
    return `${t('status.blocked')} — ${known ? t(`reason.${reason}`) : t('reason.other')}`
  }

  const pageHref = (p: number) => `/dashboard/settings/privacy?page=${p}`

  return (
    <div className="max-w-[640px]">
      <Link
        href="/dashboard/settings"
        className="text-[12px] uppercase tracking-[0.08em] text-[#8c8577]"
        style={labelStyle}
      >
        &larr; {t('back')}
      </Link>

      <SectionHeader title={t('title')} subtitle={t('subtitle')} />

      {/* Copy pending legal review. */}
      <section className="mt-6 bg-white rounded-card p-5" data-testid="privacy-explainer">
        <p className="text-[14px] text-[#1e1508] leading-relaxed" style={bodyStyle}>
          {t('explainer')}
        </p>
      </section>

      <section className="mt-4 bg-white rounded-card p-5" data-testid="privacy-requests">
        <h2 className="text-[15px] text-[#1e1508]" style={labelStyle}>
          {t('requestsTitle')}
        </h2>

        {rows.length === 0 ? (
          <p className="mt-3 text-[13px] text-[#6f6353]" style={mutedStyle} data-testid="privacy-empty">
            {t('empty')}
          </p>
        ) : (
          <table className="mt-4 w-full text-[13px]">
            <thead>
              <tr className="text-left text-[12px] text-[#8c8577] uppercase tracking-[0.06em]">
                <th className="py-2 font-medium">{t('columns.date')}</th>
                <th className="py-2 font-medium">{t('columns.type')}</th>
                <th className="py-2 font-medium">{t('columns.status')}</th>
                <th className="py-2 font-medium">{t('columns.reference')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[#f0e8d6] align-top" data-testid="privacy-row">
                  <td className="py-2 pr-2 text-[#6f6353] whitespace-nowrap">{fmt.format(new Date(r.created_at))}</td>
                  <td className="py-2 pr-2 text-[#1e1508]">{typeLabel(r.event_type)}</td>
                  <td className="py-2 pr-2 text-[#1e1508]">{statusLabel(r)}</td>
                  <td className="py-2 text-[#6f6353]">{r.event_data?.requestReference ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <nav className="mt-4 flex items-center justify-between text-[13px]" aria-label={t('pagination')}>
            {page > 1 ? (
              <Link href={pageHref(page - 1)} className="text-amber underline underline-offset-2">
                &larr; {t('prev')}
              </Link>
            ) : (
              <span />
            )}
            <span className="text-[#6f6353]" style={mutedStyle}>
              {page} / {totalPages}
            </span>
            {page < totalPages ? (
              <Link href={pageHref(page + 1)} className="text-amber underline underline-offset-2">
                {t('next')} &rarr;
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </section>
    </div>
  )
}
