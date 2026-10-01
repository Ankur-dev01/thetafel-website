import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';

/**
 * Starter teaser for Guests (PRD §4.5, Plus feature). The list behind the blur
 * is a fixed, obviously illustrative placeholder — "Voorbeeldgast 1…" with
 * made-up counts — never real guest data or names.
 */

const PLACEHOLDER_ROWS = [
  { visits: 12, when: '—' },
  { visits: 7, when: '—' },
  { visits: 5, when: '—' },
  { visits: 3, when: '—' },
  { visits: 2, when: '—' },
  { visits: 1, when: '—' },
];

export default async function GuestsTeaser({ locale, isOwner }: { locale: 'nl' | 'en'; isOwner: boolean }) {
  const t = await getTranslations({ locale, namespace: 'dashboard.guests.teaser' });
  const features = ['search', 'history', 'spend', 'notes', 'export', 'vip'] as const;

  return (
    <div className="relative mt-4" data-testid="guests-teaser">
      <div aria-hidden="true" className="pointer-events-none select-none blur-[6px] opacity-70">
        <ul className="flex flex-col gap-2">
          {PLACEHOLDER_ROWS.map((r, i) => (
            <li key={i} className="bg-white rounded-card px-4 py-3 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#e0d6c3]" />
                <span className="text-[15px] text-[#1e1508]" style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}>
                  {t('sampleName', { n: i + 1 })}
                </span>
              </span>
              <span className="text-[13px] text-[#6f6353]">{r.visits}× · {r.when}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="absolute inset-0 flex items-start justify-center pt-6 px-2">
        <div className="w-full max-w-[440px] bg-white rounded-card p-6 shadow-[0_12px_40px_rgba(30,21,8,0.12)]">
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#a86205]" style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}>
            {t('badge')}
          </p>
          <h2 className="mt-1 text-[22px] text-[#1e1508]" style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif', fontWeight: 900 }}>
            {t('title')}
          </h2>
          <p className="mt-1 text-[14px] text-[#6f6353]" style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 }}>
            {t('body')}
          </p>
          <ul className="mt-4 flex flex-col gap-1.5 text-[14px] text-[#1e1508]" style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 }}>
            {features.map((f) => (
              <li key={f} className="flex gap-2">
                <span aria-hidden="true" className="text-amber">✓</span>
                {t(`features.${f}`)}
              </li>
            ))}
          </ul>
          {isOwner ? (
            <Link
              href="/dashboard/settings/billing"
              data-testid="guests-upgrade"
              className="tafel-tap mt-5 inline-block px-5 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-amber text-[#1e1508]"
              style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
            >
              {t('cta')}
            </Link>
          ) : (
            <p className="mt-5 text-[13px] text-[#6f6353]" style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 }}>
              {t('askOwner')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
