'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import ConfirmDialog from '@/components/dashboard/ui/ConfirmDialog';

type WriteOffDialogProps = {
  open: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
  pending: boolean;
  totalCents: number;
  locale: 'nl' | 'en';
};

const MAX_REASON_LENGTH = 500;

export default function WriteOffDialog({ open, onCancel, onConfirm, pending, totalCents, locale }: WriteOffDialogProps) {
  const t = useTranslations('dashboard.tabs.writeOff.dialog');
  const [reason, setReason] = useState('');

  const currencyFormatter = new Intl.NumberFormat(locale === 'nl' ? 'nl-NL' : 'en-GB', {
    style: 'currency',
    currency: 'EUR',
  });

  function handleConfirm() {
    if (reason.trim().length === 0) return;
    onConfirm(reason.trim());
  }

  function handleCancel() {
    setReason('');
    onCancel();
  }

  const body = (
    <div className="flex flex-col gap-3">
      <p>{t('body', { amount: currencyFormatter.format(totalCents / 100) })}</p>

      <div>
        <label
          htmlFor="write-off-reason"
          className="block text-[12px] uppercase tracking-[0.08em] text-[#8c8577] mb-1"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
        >
          {t('reason.label')}
        </label>
        <textarea
          id="write-off-reason"
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
      cancelLabel={t('back')}
      destructive
      pending={pending}
      confirmDisabled={reason.trim().length === 0}
    />
  );
}
