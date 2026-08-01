'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';
import StatusChip from '@/components/dashboard/ui/StatusChip';
import { formatCents } from '@/lib/dashboard/format/money';
import { formatElapsedHoursMinutes } from '@/lib/dashboard/format/time';
import type { OpenTab } from '@/lib/dashboard/queries/tabs';

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

type TabCardProps = {
  tab: OpenTab;
  now: Date;
  locale: 'nl' | 'en';
  onSettle: () => void;
  onWriteOff: () => void;
};

export default function TabCard({ tab, now, locale, onSettle, onWriteOff }: TabCardProps) {
  const t = useTranslations('dashboard.tabs');
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const params = new URLSearchParams(searchParams.toString());
  params.set('tab', tab.id);
  const href = `${pathname}?${params.toString()}`;

  const isStale = now.getTime() - new Date(tab.opened_at).getTime() > FOUR_HOURS_MS;
  const elapsed = formatElapsedHoursMinutes(tab.opened_at, now, locale);

  function handleSettleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onSettle();
  }

  function handleWriteOffClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onWriteOff();
  }

  return (
    <Link href={href} className="tafel-tap block" data-testid={`tab-card-${tab.id}`}>
      <div className="bg-white rounded-card p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span
            className="text-[15px] text-[#1e1508]"
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
          >
            {t('card.table', { label: tab.table_label ?? '—' })}
          </span>
          <StatusChip tone={isStale ? 'warning' : 'neutral'} label={elapsed} />
        </div>

        <div
          className="text-[13px] text-[#6f6353]"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 }}
        >
          {t('card.orders', { count: tab.order_count })} ·{' '}
          {tab.guest_count === 0 ? t('card.guestsUnknown') : t('card.guests', { count: tab.guest_count })}
        </div>

        <div
          className="text-[20px] text-[#1e1508]"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 700 }}
        >
          {formatCents(tab.total_cents)}
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={handleSettleClick}
            data-testid={`tab-settle-${tab.id}`}
            className="tafel-tap flex-1 px-3.5 py-2 rounded-full text-[12px] uppercase tracking-[0.08em] bg-amber text-[#1e1508]"
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
          >
            {t('action.settle')}
          </button>
          <button
            type="button"
            onClick={handleWriteOffClick}
            data-testid={`tab-writeoff-${tab.id}`}
            className="tafel-tap flex-1 px-3.5 py-2 rounded-full text-[12px] uppercase tracking-[0.08em] bg-[#f7e8e6] text-[#b3422f]"
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
          >
            {t('action.writeOff')}
          </button>
        </div>
      </div>
    </Link>
  );
}
