import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { BarSeries } from './Charts';

/**
 * Starter preview for Insights (PRD §4.7). The chart behind the blur is a fixed
 * illustrative pattern, badged "Voorbeeld / Example" — never real data.
 */

const SAMPLE = [12, 18, 9, 22, 31, 40, 27, 14, 20, 11, 25, 34, 44, 29].map((v, i) => ({ label: String(i + 1), value: v, value2: Math.round(v / 3) }));

export default async function InsightsTeaser({ locale, isOwner }: { locale: 'nl' | 'en'; isOwner: boolean }) {
  const t = await getTranslations({ locale, namespace: 'dashboard.insights.teaser' });
  const features = ['occupancy', 'patterns', 'orders', 'dishes', 'revenue'] as const;

  return (
    <div className="relative mt-4" data-testid="insights-teaser">
      <div aria-hidden="true" className="pointer-events-none select-none blur-[5px] opacity-80 bg-white rounded-card p-5">
        <div className="mb-2 inline-block rounded-full bg-[#fcf0d8] px-3 py-1 text-[11px] uppercase tracking-[0.1em] text-[#8a5208]" style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}>
          {t('sample')}
        </div>
        <BarSeries data={SAMPLE} names={[t('sampleSeries')]} height={260} twoSeries />
      </div>
      <div className="absolute inset-0 flex items-start justify-center pt-6 px-2">
        <div className="w-full max-w-[460px] bg-white rounded-card p-6 shadow-[0_12px_40px_rgba(30,21,8,0.12)]">
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#a86205]" style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}>{t('badge')}</p>
          <h2 className="mt-1 text-[22px] text-[#1e1508]" style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif', fontWeight: 900 }}>{t('title')}</h2>
          <p className="mt-1 text-[14px] text-[#6f6353]" style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 }}>{t('body')}</p>
          <ul className="mt-4 flex flex-col gap-1.5 text-[14px] text-[#1e1508]" style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 }}>
            {features.map((f) => (
              <li key={f} className="flex gap-2"><span aria-hidden="true" className="text-amber">✓</span>{t(`features.${f}`)}</li>
            ))}
          </ul>
          {isOwner ? (
            <Link href="/dashboard/settings/billing" data-testid="insights-upgrade" className="tafel-tap mt-5 inline-block px-5 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-amber text-[#1e1508]" style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}>
              {t('cta')}
            </Link>
          ) : (
            <p className="mt-5 text-[13px] text-[#6f6353]" style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 }}>{t('askOwner')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
