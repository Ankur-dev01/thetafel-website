'use client';

import LanguageToggle from './LanguageToggle';

/**
 * Sticky header row on the cream main pane: restaurant name (small) left,
 * live-status chip + language toggle right. Page titles are rendered by the
 * pages themselves, not here.
 */

type DashboardHeaderProps = {
  locale: 'nl' | 'en';
  restaurantName: string;
  paused: boolean;
};

export default function DashboardHeader({
  locale,
  restaurantName,
  paused,
}: DashboardHeaderProps) {
  const statusLabel = paused
    ? locale === 'nl'
      ? 'Gepauzeerd'
      : 'Paused'
    : 'Live';

  return (
    <header className="sticky top-0 z-20 bg-cream/95 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-4 px-4 md:px-8 py-3">
        <div
          className="text-[13px] text-[#6f6353] truncate"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 500 }}
          title={restaurantName}
        >
          {restaurantName}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span
            className={
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] uppercase tracking-[0.1em] ' +
              (paused ? 'bg-[#fcf0d8] text-[#8a5208]' : 'bg-[#eef3e0] text-[#4a7c46]')
            }
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
          >
            {paused ? (
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <line x1="9" y1="5" x2="9" y2="19" />
                <line x1="15" y1="5" x2="15" y2="19" />
              </svg>
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-[#4a7c46]" aria-hidden="true" />
            )}
            {statusLabel}
          </span>
          <LanguageToggle locale={locale} />
        </div>
      </div>
    </header>
  );
}
