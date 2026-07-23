'use client';

import { useTranslations } from 'next-intl';
import StatusChip, { type StatusTone } from '@/components/dashboard/ui/StatusChip';
import { formatWallClockAmsterdam } from '@/lib/dashboard/format/time';
import type { DayBooking } from '@/lib/dashboard/bookings/types';

const STATUS_TONE: Record<DayBooking['status'], StatusTone> = {
  pending: 'warning',
  confirmed: 'warning',
  attended: 'success',
  cancelled: 'neutral',
  no_show: 'danger',
};

const currencyFormatter = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });

type BookingDetailProps = {
  booking: DayBooking;
};

export default function BookingDetail({ booking }: BookingDetailProps) {
  const t = useTranslations('dashboard.bookings');

  const canMarkAttended = booking.status === 'pending' || booking.status === 'confirmed';
  const canMarkNoShow = booking.status === 'confirmed';
  const canCancel = booking.status === 'pending' || booking.status === 'confirmed';

  const actionButtonClass =
    'tafel-tap px-3.5 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-[#f5ede0] text-[#8c8577] cursor-not-allowed';
  const actionButtonStyle = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 } as const;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <span
          className="text-[20px] text-[#1e1508]"
          style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif', fontWeight: 900 }}
        >
          {formatWallClockAmsterdam(booking.slot_time)}
        </span>
        <StatusChip tone={STATUS_TONE[booking.status]} label={t(`status.${booking.status}`)} />
        {booking.source === 'walk_in' && <StatusChip tone="neutral" label={t('source.walkin')} />}
      </div>

      <div>
        <div
          className="text-[16px] text-[#1e1508]"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
        >
          {booking.guest_name || '—'}
        </div>
        {booking.guest_phone && (
          <a
            href={`tel:${booking.guest_phone}`}
            className="tafel-tap text-[13px] text-[#a86205] underline underline-offset-2"
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 500 }}
          >
            {booking.guest_phone}
          </a>
        )}
        {booking.guest_note && (
          <p
            className="mt-2 text-[13px] text-[#6f6353] italic leading-relaxed"
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 }}
          >
            {t('detail.guestNote')}: {booking.guest_note}
          </p>
        )}
      </div>

      <div className="text-[14px] text-[#1e1508]" style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 500 }}>
        {t('detail.party', { count: booking.party_size })}
      </div>

      <div>
        <div
          className="text-[11px] uppercase tracking-[0.1em] text-[#8c8577] mb-1"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
        >
          {t('detail.zone')} · {t('detail.tables')}
        </div>
        <div className="text-[14px] text-[#1e1508]" style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 }}>
          {booking.zone_name ?? '—'} · {booking.table_labels.length > 0 ? booking.table_labels.join(', ') : '—'}
        </div>
      </div>

      {booking.deposit_amount_cents !== null && booking.deposit_amount_cents > 0 && (
        <div>
          <div
            className="text-[14px] text-[#1e1508]"
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 500 }}
          >
            {t('detail.deposit', { amount: currencyFormatter.format(booking.deposit_amount_cents / 100) })}
          </div>
          {booking.deposit_state === 'pending' && (
            <div className="mt-1">
              <StatusChip tone="warning" label={t('deposit.pending')} />
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-2 border-t border-[#f0e8d8]">
        {canMarkAttended && (
          <button
            type="button"
            disabled
            title={t('action.stubTooltip')}
            data-testid="detail-mark-attended-stub"
            className={actionButtonClass}
            style={actionButtonStyle}
          >
            {t('action.markAttended')}
          </button>
        )}
        {canMarkNoShow && (
          <button
            type="button"
            disabled
            title={t('action.stubTooltip')}
            data-testid="detail-mark-noshow-stub"
            className={actionButtonClass}
            style={actionButtonStyle}
          >
            {t('action.markNoShow')}
          </button>
        )}
        {canCancel && (
          <button
            type="button"
            disabled
            title={t('action.stubTooltip')}
            data-testid="detail-cancel-stub"
            className={actionButtonClass}
            style={actionButtonStyle}
          >
            {t('action.cancel')}
          </button>
        )}
        <button
          type="button"
          disabled
          title={t('action.stubTooltip')}
          data-testid="detail-edit-stub"
          className={actionButtonClass}
          style={actionButtonStyle}
        >
          {t('action.edit')}
        </button>
      </div>
    </div>
  );
}
