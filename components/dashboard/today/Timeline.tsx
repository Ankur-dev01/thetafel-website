'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import SectionHeader from '@/components/dashboard/ui/SectionHeader';
import EmptyState from '@/components/dashboard/ui/EmptyState';
import { Plate } from '@/components/dashboard/icons';
import TimelineRow, { type TimelineItem } from './TimelineRow';
import type { TodayBooking, TodayOrder } from '@/lib/dashboard/queries/today';

const PICKUP_TIMELINE_STATUSES = new Set(['pending', 'confirmed', 'preparing', 'ready']);

type TimelineProps = {
  bookings: TodayBooking[];
  orders: TodayOrder[];
  nowIso: string;
};

export default function Timeline({ bookings, orders, nowIso }: TimelineProps) {
  const t = useTranslations('dashboard.today');
  const now = new Date(nowIso);

  const items: TimelineItem[] = [
    ...bookings.map((b): TimelineItem => ({ kind: 'booking', at: new Date(b.slot_time), ref: b })),
    ...orders
      .filter(
        (o) =>
          o.order_type === 'takeaway' &&
          o.pickup_time !== null &&
          PICKUP_TIMELINE_STATUSES.has(o.status)
      )
      .map((o): TimelineItem => ({ kind: 'pickup', at: new Date(o.pickup_time as string), ref: o })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  const upcoming = items.filter((i) => i.at >= now);
  const past = items.filter((i) => i.at < now);

  if (upcoming.length === 0 && past.length === 0) {
    return (
      <div>
        <SectionHeader title={t('timeline.title')} />
        <EmptyState
          illustration={<Plate width={48} height={48} />}
          heading={t('timeline.empty.title')}
          body={t('timeline.empty.body')}
          action={
            <Link
              href="/dashboard/bookings?walkin=1"
              className="tafel-tap inline-flex px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-amber text-[#1e1508]"
              style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
            >
              {t('timeline.empty.action')}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <SectionHeader title={t('timeline.title')} />
      <div className="flex flex-col gap-2.5">
        {upcoming.map((item) => (
          <TimelineRow key={`${item.kind}-${item.ref.id}`} item={item} />
        ))}
      </div>

      {past.length > 0 && (
        <details className="mt-4 group">
          <summary
            className="tafel-tap cursor-pointer text-[13px] text-[#6f6353] uppercase tracking-[0.08em] list-none flex items-center gap-1.5"
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-transform group-open:rotate-90"
              aria-hidden="true"
            >
              <path d="M9.4 5.6l6.4 6.4-6.3 6.4" />
            </svg>
            {t('timeline.past', { count: past.length })}
          </summary>
          <div className="mt-2.5 flex flex-col gap-2.5">
            {past.map((item) => (
              <TimelineRow key={`${item.kind}-${item.ref.id}`} item={item} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
