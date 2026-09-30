import { after } from 'next/server'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { resolveDashboardContext } from '@/lib/dashboard/resolveDashboardContext'
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'
import {
  isMollieBrokenRow,
  resolveMollieConnection,
  type MollieConnectionRow,
  type MollieConnectionState,
} from '@/lib/dashboard/payments/connectionStatus'
import { notifyMollieBrokenOnce } from '@/lib/dashboard/payments/notifyMollieBrokenOnce'
import SectionHeader from '@/components/dashboard/ui/SectionHeader'
import ReconnectButton from './ReconnectButton'

export const dynamic = 'force-dynamic'

type Params = { locale: string }
type SearchParams = { mollie?: string }

const STATE_COLOR: Record<MollieConnectionState, string> = {
  connected: '#5fb46f',
  expired: '#c64a4a',
  action_needed: '#d4820a',
  not_connected: '#8c8577',
}

const STATE_KEY: Record<MollieConnectionState, string> = {
  connected: 'connected',
  expired: 'expired',
  action_needed: 'actionNeeded',
  not_connected: 'notConnected',
}

const labelStyle = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 } as const
const bodyStyle = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 } as const
const mutedStyle = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 300 } as const

export default async function PaymentsSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<Params>
  searchParams: Promise<SearchParams>
}) {
  const { locale: rawLocale } = await params
  const { mollie: flash } = await searchParams
  const locale: 'nl' | 'en' = rawLocale === 'en' ? 'en' : 'nl'

  const context = await resolveDashboardContext(locale)

  // Owner-only — same redirect as /settings/notifications.
  if (context.staff.role !== 'owner') {
    redirect(locale === 'en' ? '/en/dashboard/settings' : '/dashboard/settings')
  }

  const row = context.restaurant as unknown as MollieConnectionRow
  const admin = await createSupabaseServerClientAdmin()
  const info = await resolveMollieConnection(admin, context.restaurant.id, row)

  // Broken connection → owner email, max 1 per 24h (deduped inside; never
  // fires for a restaurant that never connected). After the response is sent.
  if (info.state === 'expired' || isMollieBrokenRow(row, new Date())) {
    const restaurantId = context.restaurant.id
    after(() => notifyMollieBrokenOnce(restaurantId, { liveExpired: info.liveAuthFailed }))
  }

  const t = await getTranslations({ locale, namespace: 'dashboard.settings.payments' })
  const key = STATE_KEY[info.state]
  const color = STATE_COLOR[info.state]

  const verifiedAt = info.verifiedAt
    ? new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'nl-NL', {
        timeZone: 'Europe/Amsterdam',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(info.verifiedAt))
    : null

  const reconnectLabels = {
    reconnect: t('reconnect'),
    connecting: t('reconnecting'),
    error: t('reconnectError'),
  }

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

      {flash === 'connected' && (
        <p
          role="status"
          data-testid="payments-flash-connected"
          className="mt-4 rounded-card bg-[#eef7f0] p-3 text-[13px] text-[#2f6b3d]"
          style={bodyStyle}
        >
          {t('flash.connected')}
        </p>
      )}
      {flash === 'error' && (
        <p
          role="alert"
          data-testid="payments-flash-error"
          className="mt-4 rounded-card bg-[#fbeeee] p-3 text-[13px] text-[#9b3030]"
          style={bodyStyle}
        >
          {t('flash.error')}
        </p>
      )}

      <section className="mt-6 bg-white rounded-card p-5" data-testid="payments-status-card" data-state={info.state}>
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: color }}
          />
          <h2 className="text-[16px] text-[#1e1508]" style={labelStyle} data-testid="payments-status-label">
            {t(`state.${key}.label`)}
          </h2>
        </div>

        <p className="mt-3 text-[14px] text-[#1e1508] leading-relaxed" style={bodyStyle} data-testid="payments-guest-impact">
          {t(`state.${key}.guests`)}
        </p>

        {info.liveCheckUnavailable && (
          <p className="mt-2 text-[12px] text-[#8c8577]" style={mutedStyle} data-testid="payments-live-unavailable">
            {t('liveCheckUnavailable')}
          </p>
        )}

        {(info.organizationIdMasked || verifiedAt) && (
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
            {info.organizationIdMasked && (
              <>
                <dt className="text-[#8c8577]" style={mutedStyle}>{t('organization')}</dt>
                <dd className="text-[#1e1508]" style={bodyStyle} data-testid="payments-org-id">
                  {info.organizationIdMasked}
                </dd>
              </>
            )}
            {verifiedAt && (
              <>
                <dt className="text-[#8c8577]" style={mutedStyle}>{t('lastVerified')}</dt>
                <dd className="text-[#1e1508]" style={bodyStyle}>{verifiedAt}</dd>
              </>
            )}
          </dl>
        )}

        <div className="mt-5">
          <ReconnectButton
            locale={locale}
            variant={info.state === 'connected' ? 'quiet' : 'primary'}
            labels={{
              ...reconnectLabels,
              reconnect: info.state === 'not_connected' ? t('connect') : reconnectLabels.reconnect,
            }}
          />
        </div>
      </section>
    </div>
  )
}
