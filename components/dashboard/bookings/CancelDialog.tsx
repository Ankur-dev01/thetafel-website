'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import ConfirmDialog from '@/components/dashboard/ui/ConfirmDialog';

type DepositState = 'not_required' | 'pending' | 'paid' | 'failed' | 'refunded';

type CancelDialogProps = {
  open: boolean;
  onCancel: () => void;
  onConfirm: (reason?: string) => void;
  pending: boolean;
  depositState: DepositState;
  depositAmountCents: number | null;
  locale: 'nl' | 'en';
};

const MAX_REASON_LENGTH = 500;

export default function CancelDialog({
  open,
  onCancel,
  onConfirm,
  pending,
  depositState,
  depositAmountCents,
  locale,
}: CancelDialogProps) {
  const t = useTranslations('dashboard.bookings.action.dialog.cancel');
  const [reason, setReason] = useState('');

  const currencyFormatter = new Intl.NumberFormat(locale === 'nl' ? 'nl-NL' : 'en-GB', {
    style: 'currency',
    currency: 'EUR',
  });

  function handleConfirm() {
    onConfirm(reason.trim().length > 0 ? reason.trim() : undefined);
  }

  function handleCancel() {
    setReason('');
    onCancel();
  }

  const body = (
    <div className="flex flex-col gap-3">
      <p>{t('body')}</p>

      {depositState === 'paid' && depositAmountCents !== null && (
        <p className="text-[13px] text-[#a86205] bg-[#fdf3e0] rounded-lg px-3 py-2">
          {t('deposit.paid', { amount: currencyFormatter.format(depositAmountCents / 100) })}
        </p>
      )}
      {depositState === 'pending' && (
        <p className="text-[13px] text-[#a86205] bg-[#fdf3e0] rounded-lg px-3 py-2">{t('deposit.pending')}</p>
      )}

      <div>
        <label
          htmlFor="cancel-reason"
          className="block text-[12px] uppercase tracking-[0.08em] text-[#8c8577] mb-1"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
        >
          {t('reason.label')}
        </label>
        <textarea
          id="cancel-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, MAX_REASON_LENGTH))}
          disabled={pending}
          rows={3}
          className="w-full rounded-lg border border-[#e7ddc9] px-3 py-2 text-[14px] text-[#1e1508] bg-white resize-none focus:outline-none focus:ring-2 focus:ring-amber"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 }}
        />
        <div className="text-right text-[11px] text-[#8c8577] mt-1">
          {reason.length}/{MAX_REASON_LENGTH}
        </div>
      </div>
    </div>
  );

  return (
    <ConfirmDialog
      open={open}
      onCancel={handleCancel}
      onConfirm={handleConfirm}
      title={t('title')}
      body={body}
      confirmLabel={t('confirm')}
      cancelLabel={t('cancel')}
      destructive
      pending={pending}
    />
  );
}
