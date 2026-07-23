import { getTranslations } from 'next-intl/server'
import { resolveDashboardContext } from '@/lib/dashboard/resolveDashboardContext'
import SectionHeader from '@/components/dashboard/ui/SectionHeader'
import PauseControl from '@/components/dashboard/settings/PauseControl'

export const dynamic = 'force-dynamic'

type Params = { locale: string }

const UPCOMING_KEYS_NL = [
  'Openingstijden',
  'Zaalindeling',
  'Menu',
  'Team',
  'Betalingen',
  'Facturatie',
  'Privacy',
  'Account',
]

const UPCOMING_KEYS_EN = [
  'Hours',
  'Floor plan',
  'Menu',
  'Team',
  'Payments',
  'Billing',
  'Privacy',
  'Account',
]

export default async function SettingsPage({ params }: { params: Promise<Params> }) {
  const { locale: rawLocale } = await params
  const locale: 'nl' | 'en' = rawLocale === 'en' ? 'en' : 'nl'

  const context = await resolveDashboardContext(locale)
  const t = await getTranslations('dashboard.settings')

  const upcoming = locale === 'en' ? UPCOMING_KEYS_EN : UPCOMING_KEYS_NL

  return (
    <div className="max-w-[640px]">
      <SectionHeader title={t('title')} />

      <div className="mt-2">
        <h2
          className="text-[13px] uppercase tracking-[0.12em] text-[#8c8577] mb-2"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
        >
          {t('status.title')}
        </h2>
        <PauseControl
          initialPausedAt={context.restaurant.paused_at}
          initialPauseReason={
            context.restaurant.pause_reason as 'manual' | 'billing_suspended' | null
          }
        />
      </div>

      <div className="mt-8">
        <p
          className="text-[13px] uppercase tracking-[0.1em] text-[#8c8577] mb-2"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
        >
          {t('hub.upcoming.title')}
        </p>
        <ul className="flex flex-col gap-1">
          {upcoming.map((label) => (
            <li
              key={label}
              className="text-[14px] text-[#6f6353]"
              style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 300 }}
            >
              {label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
