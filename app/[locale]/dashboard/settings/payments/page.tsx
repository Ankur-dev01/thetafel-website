import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import SectionHeader from '@/components/dashboard/ui/SectionHeader'

export const dynamic = 'force-dynamic'

export default async function PaymentsSettingsPage() {
  const t = await getTranslations('dashboard.settings.payments')

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

      <div className="mt-6 bg-white rounded-card p-5">
        <p
          className="text-[14px] text-[#1e1508] leading-relaxed"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 }}
        >
          {t('body')}
        </p>
        <p
          className="mt-3 text-[14px] text-[#1e1508] leading-relaxed"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 }}
        >
          {t('contact')}{' '}
          <a
            href="mailto:hello@thetafel.nl"
            className="text-amber underline underline-offset-2"
          >
            hello@thetafel.nl
          </a>
        </p>
      </div>
    </div>
  )
}
