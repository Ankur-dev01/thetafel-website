'use client';

import { useTranslations } from 'next-intl';

/**
 * Rendered by the Vandaag page when getTodayPayload throws server-side.
 * The dashboard shell (header/sidebar/tab bar) stays mounted around this —
 * only the page content is replaced.
 */
export default function TodayErrorState() {
  const t = useTranslations('dashboard.today.error');

  return (
    <div className="bg-[#f7f2e9] rounded-card px-6 py-10 mt-4 flex flex-col items-center text-center">
      <h1
        className="text-[19px] text-[#1e1508]"
        style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif', fontWeight: 900 }}
      >
        {t('title')}
      </h1>
      <p
        className="mt-2 text-[14px] text-[#6f6353] leading-relaxed max-w-[380px]"
        style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 300 }}
      >
        {t('body')}
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="tafel-tap mt-5 px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-amber text-[#1e1508]"
        style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
      >
        {t('action')}
      </button>
    </div>
  );
}
