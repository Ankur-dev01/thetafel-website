'use client';

import { useTranslations } from 'next-intl';
import type { BookingFilterKey } from '@/lib/dashboard/bookings/filters';
import { BOOKING_FILTER_KEYS } from '@/lib/dashboard/bookings/filters';

const LABEL_KEY: Record<BookingFilterKey, string> = {
  verwacht: 'expected',
  aangekomen: 'attended',
  geannuleerd: 'cancelled',
  no_show: 'noShow',
  deposit_pending: 'depositPending',
  upcoming: 'upcoming',
  payment_failed: 'paymentFailed',
};

type FilterChipsProps = {
  value: BookingFilterKey | null;
  onChange: (value: BookingFilterKey | null) => void;
  counts: Record<BookingFilterKey, number>;
};

export default function FilterChips({ value, onChange, counts }: FilterChipsProps) {
  const t = useTranslations('dashboard.bookings.filter');

  const chipClass = (active: boolean) =>
    'tafel-tap flex-shrink-0 px-3.5 py-2 rounded-full text-[13px] whitespace-nowrap transition-colors ' +
    (active ? 'bg-amber text-[#1e1508]' : 'bg-[#f5ede0] text-[#6f6353]');

  const chipStyle = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 } as const;

  return (
    <div className="flex gap-2 overflow-x-auto md:flex-wrap md:overflow-visible pb-1">
      <button type="button" onClick={() => onChange(null)} className={chipClass(value === null)} style={chipStyle}>
        {t('all')}
      </button>
      {BOOKING_FILTER_KEYS.map((key) => {
        const count = counts[key];
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={chipClass(value === key)}
            style={chipStyle}
          >
            {t(LABEL_KEY[key])}
            {count > 0 ? ` (${count})` : ''}
          </button>
        );
      })}
    </div>
  );
}
