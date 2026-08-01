'use client';

import { useTranslations } from 'next-intl';

export type OrderTypeFilter = 'all' | 'qr' | 'takeaway';

type OrderFilterChipsProps = {
  value: OrderTypeFilter;
  onChange: (value: OrderTypeFilter) => void;
  counts: Record<OrderTypeFilter, number>;
};

const KEYS: OrderTypeFilter[] = ['all', 'qr', 'takeaway'];

export default function OrderFilterChips({ value, onChange, counts }: OrderFilterChipsProps) {
  const t = useTranslations('dashboard.orders.filter');

  const chipClass = (active: boolean) =>
    'tafel-tap flex-shrink-0 px-3.5 py-2 rounded-full text-[13px] whitespace-nowrap transition-colors ' +
    (active ? 'bg-amber text-[#1e1508]' : 'bg-[#f5ede0] text-[#6f6353]');

  const chipStyle = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 } as const;

  return (
    <div className="flex gap-2 overflow-x-auto md:flex-wrap md:overflow-visible pb-1">
      {KEYS.map((key) => {
        const count = counts[key];
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={chipClass(value === key)}
            style={chipStyle}
          >
            {t(key)}
            {count > 0 ? ` (${count})` : ''}
          </button>
        );
      })}
    </div>
  );
}
