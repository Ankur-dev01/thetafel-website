'use client';

import { useTranslations } from 'next-intl';

export type DetailTabKey = 'overview' | 'history' | 'guest';

const TAB_KEYS: DetailTabKey[] = ['overview', 'history', 'guest'];

type DetailTabsProps = {
  active: DetailTabKey;
  onChange: (tab: DetailTabKey) => void;
};

/**
 * Phone-only three-tab strip (Overzicht / Historie / Gast). Purely local
 * state in the parent — tab selection is transient UI, not URL-owned (only
 * booking selection lives in the URL, per D2.1's contract).
 */
export default function DetailTabs({ active, onChange }: DetailTabsProps) {
  const t = useTranslations('dashboard.bookings.detail.tab');

  return (
    <div className="flex border-b border-[#f0e8d8]" role="tablist">
      {TAB_KEYS.map((key) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(key)}
            className={
              'tafel-tap flex-1 py-2.5 text-[12px] uppercase tracking-[0.08em] border-b-2 -mb-px transition-colors ' +
              (isActive ? 'border-amber text-[#1e1508]' : 'border-transparent text-[#8c8577]')
            }
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
          >
            {t(key)}
          </button>
        );
      })}
    </div>
  );
}
