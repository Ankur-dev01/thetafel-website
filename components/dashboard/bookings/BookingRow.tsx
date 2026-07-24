'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';
import StatusChip, { type StatusTone } from '@/components/dashboard/ui/StatusChip';
import { Coins } from '@/components/dashboard/icons';
import { formatWallClockAmsterdam } from '@/lib/dashboard/format/time';
import type { DayBooking } from '@/lib/dashboard/bookings/types';

const STATUS_TONE: Record<DayBooking['status'], StatusTone> = {
  pending: 'warning',
  confirmed: 'warning',
  attended: 'success',
  cancelled: 'neutral',
  no_show: 'danger',
};

type BookingRowProps = {
  booking: DayBooking;
};

export default function BookingRow({ booking }: BookingRowProps) {
  const t = useTranslations('dashboard.bookings');
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const params = new URLSearchParams(searchParams.toString());
  params.set('booking', booking.id);
  const href = `${pathname}?${params.toString()}`;

  const subMeta = `${booking.party_size} · ${booking.zone_name ?? '—'} · ${
    booking.table_labels.length > 0 ? booking.table_labels.join(', ') : '—'
  }`;

  return (
    <Link href={href} className="tafel-tap block">
      <div className="bg-white rounded-card p-4 flex items-center gap-4">
        <div
          className="text-[15px] text-[#1e1508] w-14 flex-shrink-0"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 700 }}
        >
          {formatWallClockAmsterdam(booking.slot_time)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="text-[15px] text-[#1e1508] truncate"
              style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
            >
              {booking.guest_anonymised ? t('anonymisedGuest') : booking.guest_name || '—'}
            </span>
            {booking.source === 'walk_in' && (
              <StatusChip tone="neutral" label={t('source.walkin')} />
            )}
          </div>
          <div
            className="text-[13px] text-[#6f6353] truncate"
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 }}
          >
            {subMeta}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <StatusChip tone={STATUS_TONE[booking.status]} label={t(`status.${booking.status}`)} />
          {booking.deposit_state === 'pending' && (
            <StatusChip
              tone="warning"
              icon={<Coins width={12} height={12} />}
              label={t('deposit.pending')}
            />
          )}
        </div>
      </div>
    </Link>
  );
}
