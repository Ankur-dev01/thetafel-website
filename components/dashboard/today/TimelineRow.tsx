'use client';

import { useTranslations } from 'next-intl';
import StatusChip, { type StatusTone } from '@/components/dashboard/ui/StatusChip';
import { formatWallClockAmsterdam } from '@/lib/dashboard/format/time';
import type { TodayBooking, TodayOrder } from '@/lib/dashboard/queries/today';

export type TimelineItem =
  | { kind: 'booking'; at: Date; ref: TodayBooking }
  | { kind: 'pickup'; at: Date; ref: TodayOrder };

const BOOKING_STATUS_TONE: Record<TodayBooking['status'], StatusTone> = {
  pending: 'neutral',
  confirmed: 'warning',
  attended: 'success',
};

const PICKUP_STATUS_TONE: Record<'pending' | 'confirmed' | 'preparing' | 'ready', StatusTone> = {
  pending: 'neutral',
  confirmed: 'neutral',
  preparing: 'warning',
  ready: 'success',
};

type TimelineRowProps = {
  item: TimelineItem;
};

export default function TimelineRow({ item }: TimelineRowProps) {
  const t = useTranslations('dashboard.today');

  if (item.kind === 'booking') {
    const b = item.ref;
    const subMeta = `${b.party_size} personen · ${b.zone_name ?? '—'} · ${
      b.table_labels.length > 0 ? b.table_labels.join(', ') : 'geen tafel'
    }`;

    return (
      <div className="bg-white rounded-card p-4 flex items-center gap-4 flex-wrap">
        <div
          className="text-lg text-[#1e1508] w-14 flex-shrink-0"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 700 }}
        >
          {formatWallClockAmsterdam(b.slot_time)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="text-[15px] text-[#1e1508] truncate"
              style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 500 }}
            >
              {b.guest_name || '—'}
            </span>
            {b.source === 'walk_in' && (
              <StatusChip tone="neutral" label={t('walkinChip')} />
            )}
          </div>
          <div
            className="text-[13px] text-[#6f6353] truncate"
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 }}
          >
            {subMeta}
          </div>
        </div>
        <StatusChip tone={BOOKING_STATUS_TONE[b.status]} label={t(`status.booking.${b.status}`)} />
        {b.status === 'confirmed' && (
          <button
            type="button"
            disabled
            title="Beschikbaar in D2.3"
            data-testid="timeline-mark-attended-stub"
            className="tafel-tap px-3.5 py-2 rounded-full text-[12px] uppercase tracking-[0.08em] bg-[#f5ede0] text-[#1e1508]"
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
          >
            {t('action.markAttended')}
          </button>
        )}
      </div>
    );
  }

  const o = item.ref;
  const pickupStatus = o.status as 'pending' | 'confirmed' | 'preparing' | 'ready';
  const statusKey =
    pickupStatus === 'preparing' ? 'preparing' : pickupStatus === 'ready' ? 'ready' : 'received';

  return (
    <div className="bg-white rounded-card p-4 flex items-center gap-4 flex-wrap">
      <div
        className="text-lg text-[#1e1508] w-14 flex-shrink-0"
        style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 700 }}
      >
        {o.pickup_time ? formatWallClockAmsterdam(o.pickup_time) : '—'}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="text-[15px] text-[#1e1508] truncate"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 500 }}
        >
          Afhaal — {o.order_ref}
        </div>
        <div
          className="text-[13px] text-[#6f6353] truncate"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 }}
        >
          {o.guest_name ?? '—'}
        </div>
        <div
          className="text-[13px] text-[#6f6353] truncate"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 }}
        >
          Afhaalmoment {o.pickup_time ? formatWallClockAmsterdam(o.pickup_time) : '—'}
        </div>
      </div>
      <StatusChip tone={PICKUP_STATUS_TONE[pickupStatus]} label={t(`status.pickup.${statusKey}`)} />
      {pickupStatus === 'preparing' && (
        <button
          type="button"
          disabled
          title="Beschikbaar in D3.2"
          data-testid="timeline-mark-ready-stub"
          className="tafel-tap px-3.5 py-2 rounded-full text-[12px] uppercase tracking-[0.08em] bg-[#f5ede0] text-[#1e1508]"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
        >
          {t('action.markReady')}
        </button>
      )}
      {pickupStatus === 'ready' && (
        <button
          type="button"
          disabled
          title="Beschikbaar in D3.2"
          data-testid="timeline-picked-up-stub"
          className="tafel-tap px-3.5 py-2 rounded-full text-[12px] uppercase tracking-[0.08em] bg-[#f5ede0] text-[#1e1508]"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
        >
          {t('action.pickedUp')}
        </button>
      )}
    </div>
  );
}
