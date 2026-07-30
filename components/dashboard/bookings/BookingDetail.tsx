'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import StatusChip, { type StatusTone } from '@/components/dashboard/ui/StatusChip';
import { formatWallClockAmsterdam } from '@/lib/dashboard/format/time';
import GuestSummary from './GuestSummary';
import BookingHistory from './BookingHistory';
import DeliveryTimeline from './DeliveryTimeline';
import DetailTabs, { type DetailTabKey } from './DetailTabs';
import CancelDialog from './CancelDialog';
import BookingEditDialog from './BookingEditDialog';
import { useBookingActions } from '@/lib/dashboard/actions/bookingActions';
import type { BookableZoneOption, BookingDetailPayload } from '@/lib/dashboard/bookings/types';

const STATUS_TONE: Record<BookingDetailPayload['booking']['status'], StatusTone> = {
  pending: 'warning',
  confirmed: 'warning',
  attended: 'success',
  cancelled: 'neutral',
  no_show: 'danger',
};

const currencyFormatter = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });

const NO_SHOW_GRACE_MINUTES = 30;

const KNOWN_ACTION_ERROR_CODES = new Set([
  'already_attended',
  'already_no_show',
  'already_cancelled',
  'terminal_state',
  'too_early',
  'outside_availability',
  'half_full_violated',
  'table_conflict',
  'no_changes',
  'rate_limited',
  'not_found',
  'not_authenticated',
]);

type BookingDetailProps = {
  payload: BookingDetailPayload;
  zones: BookableZoneOption[];
  locale: 'nl' | 'en';
};

export default function BookingDetail({ payload, zones, locale }: BookingDetailProps) {
  const { booking, guestSummary, guestNote, history, delivery } = payload;
  const t = useTranslations('dashboard.bookings');
  const [activeTab, setActiveTab] = useState<DetailTabKey>('overview');
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const actions = useBookingActions(booking.id);

  const canMarkAttended = booking.status === 'pending' || booking.status === 'confirmed';
  const minutesAfterSlot = (Date.now() - new Date(booking.slot_time).getTime()) / 60_000;
  const canMarkNoShow = booking.status === 'confirmed';
  const noShowGraceElapsed = minutesAfterSlot >= NO_SHOW_GRACE_MINUTES;
  const canCancel = booking.status === 'pending' || booking.status === 'confirmed' || booking.status === 'attended';
  const canEdit = booking.status === 'pending' || booking.status === 'confirmed';

  const actionButtonClass =
    'tafel-tap px-3.5 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] transition-colors disabled:cursor-not-allowed disabled:opacity-60';
  const actionButtonStyle = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 } as const;
  const activeButtonClass = `${actionButtonClass} bg-[#f5ede0] text-[#1e1508]`;
  const destructiveButtonClass = `${actionButtonClass} bg-[#f5ede0] text-[#b3422f]`;

  function errorLabel(code: string): string {
    return t(`action.error.${KNOWN_ACTION_ERROR_CODES.has(code) ? code : 'unknown'}`);
  }

  async function handleAttend() {
    setActionError(null);
    const result = await actions.attend();
    if (!result.ok) setActionError(result.code);
  }

  async function handleNoShow() {
    setActionError(null);
    const result = await actions.noShow();
    if (!result.ok) setActionError(result.code);
  }

  async function handleCancelConfirm(reason?: string) {
    setActionError(null);
    const result = await actions.cancel(reason);
    if (result.ok) {
      setShowCancelDialog(false);
    } else {
      setActionError(result.code);
    }
  }

  const guestDisplayName = booking.guest_anonymised
    ? t('anonymisedGuest')
    : booking.guest_name || '—';

  const header = (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
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
          {guestDisplayName}
        </div>
        {!booking.guest_anonymised && booking.guest_phone && (
          <a
            href={`tel:${booking.guest_phone}`}
            className="tafel-tap text-[13px] text-[#a86205] underline underline-offset-2"
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 500 }}
          >
            {booking.guest_phone}
          </a>
        )}
      </div>
    </div>
  );

  const overviewSection = (
    <div className="flex flex-col gap-4">
      {booking.guest_note && (
        <p
          className="text-[13px] text-[#6f6353] italic leading-relaxed"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 }}
        >
          {t('detail.guestNoteFromBooking.title')}: {booking.guest_note}
        </p>
      )}

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
        <div
          className="text-[14px] text-[#1e1508]"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 500 }}
        >
          {t('detail.deposit', { amount: currencyFormatter.format(booking.deposit_amount_cents / 100) })}
        </div>
      )}

      <DeliveryTimeline delivery={delivery} locale={locale} />
    </div>
  );

  const historySection = <BookingHistory history={history} locale={locale} />;
  const guestSection = <GuestSummary summary={guestSummary} guestNote={guestNote} locale={locale} />;

  const actionsRow = (
    <div className="flex flex-col gap-2 pt-3 border-t border-[#f0e8d8]">
      <div className="flex flex-wrap gap-2">
        {canMarkAttended && (
          <button
            type="button"
            onClick={handleAttend}
            disabled={actions.pending}
            data-testid="detail-mark-attended"
            className={activeButtonClass}
            style={actionButtonStyle}
          >
            {t('action.markAttended')}
          </button>
        )}
        {canMarkNoShow && (
          <button
            type="button"
            onClick={handleNoShow}
            disabled={actions.pending || !noShowGraceElapsed}
            title={noShowGraceElapsed ? undefined : t('action.tooltip.tooEarly')}
            data-testid="detail-mark-noshow"
            className={activeButtonClass}
            style={actionButtonStyle}
          >
            {t('action.markNoShow')}
          </button>
        )}
        {canCancel && (
          <button
            type="button"
            onClick={() => setShowCancelDialog(true)}
            disabled={actions.pending}
            data-testid="detail-cancel"
            className={destructiveButtonClass}
            style={actionButtonStyle}
          >
            {t('action.cancel')}
          </button>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={() => setShowEditDialog(true)}
            disabled={actions.pending}
            data-testid="detail-edit"
            className={activeButtonClass}
            style={actionButtonStyle}
          >
            {t('action.edit')}
          </button>
        )}
      </div>
      {actionError && (
        <p className="text-[13px] text-[#b3422f]" data-testid="detail-action-error">
          {errorLabel(actionError)}
        </p>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      {header}

      {/* Desktop (>=768px): everything stacked, one scroll. Both this block
          and the phone block below are always mounted (CSS toggles which is
          visible) — same dual-mount pattern as D2.1's DetailPanel/DetailSheet.
          data-testid + :visible scoping in tests distinguishes them. */}
      <div className="hidden md:flex md:flex-col gap-5" data-testid="detail-body-desktop">
        {overviewSection}
        {guestSection}
        {historySection}
        {actionsRow}
      </div>

      {/* Phone (<768px): tabbed. Actions stay visible on every tab. */}
      <div className="md:hidden flex flex-col gap-4" data-testid="detail-body-phone">
        <DetailTabs active={activeTab} onChange={setActiveTab} />
        {activeTab === 'overview' && overviewSection}
        {activeTab === 'history' && historySection}
        {activeTab === 'guest' && guestSection}
        {actionsRow}
      </div>

      <CancelDialog
        open={showCancelDialog}
        onCancel={() => setShowCancelDialog(false)}
        onConfirm={handleCancelConfirm}
        pending={actions.pending}
        depositState={delivery.depositIntent.state}
        depositAmountCents={delivery.depositIntent.amountCents}
        locale={locale}
      />

      {showEditDialog && (
        <BookingEditDialog
          open={showEditDialog}
          onClose={() => setShowEditDialog(false)}
          onSubmit={actions.edit}
          pending={actions.pending}
          locale={locale}
          zones={zones}
          booking={{
            slot_time: booking.slot_time,
            party_size: booking.party_size,
            zone_id: booking.zone_id,
            table_ids: booking.table_ids,
            guest_note: booking.guest_note,
          }}
        />
      )}
    </div>
  );
}
