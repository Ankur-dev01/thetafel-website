import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { BarSeries } from './Charts';

/** Plus sees revenue as a locked teaser. The blurred chart is badged "Voorbeeld / Example" and uses fixed illustrative values. */
const SAMPLE = [320, 410, 280, 520, 690, 840, 610, 350, 450, 300, 560, 720].map((v, i) => ({ label: String(i + 1), value: v }));

export default async function RevenueLocked({ locale, isOwner }: { locale: 'nl' | 'en'; isOwner: boolean }) {
  const t = await getTranslations({ locale, namespace: 'dashboard.insights.revenue' });
  return (
    <section className="relative mt-4" data-testid="revenue-locked">
      <div aria-hidden="true" className="pointer-events-none select-none blur-[5px] opacity-80 bg-white rounded-card p-5">
        <div className="mb-2 inline-block rounded-full bg-[#fcf0d8] px-3 py-1 text-[11px] uppercase tracking-[0.1em] text-[#8a5208]" style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}>
          {t('locked.sample')}
        </div>
        <BarSeries data={SAMPLE} names={[t('locked.sample')]} height={200} />
      </div>
      <div className="absolute inset-0 flex items-center justify-center px-2">
        <div className="w-full max-w-[420px] bg-white rounded-card p-5 shadow-[0_12px_40px_rgba(30,21,8,0.12)]">
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#a86205]" style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}>{t('locked.badge')}</p>
          <h2 className="mt-1 text-[19px] text-[#1e1508]" style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif', fontWeight: 900 }}>{t('locked.title')}</h2>
          <p className="mt-1 text-[13px] text-[#6f6353]" style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 }}>{t('locked.body')}</p>
          {isOwner ? (
            <Link href="/dashboard/settings/billing" data-testid="revenue-upgrade" className="tafel-tap mt-4 inline-block px-5 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-amber text-[#1e1508]" style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}>
              {t('locked.cta')}
            </Link>
          ) : (
            <p className="mt-4 text-[13px] text-[#6f6353]" style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 }}>{t('locked.askOwner')}</p>
          )}
        </div>
      </div>
    </section>
  );
}
