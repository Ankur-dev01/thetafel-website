'use client';

import { useTranslations } from 'next-intl';
import ConfirmDialog from '@/components/dashboard/ui/ConfirmDialog';

type CloseTabDialogProps = {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
  totalCents: number;
  locale: 'nl' | 'en';
};

export default function CloseTabDialog({ open, onCancel, onConfirm, pending, totalCents, locale }: CloseTabDialogProps) {
  const t = useTranslations('dashboard.tabs.settle.dialog');

  const currencyFormatter = new Intl.NumberFormat(locale === 'nl' ? 'nl-NL' : 'en-GB', {
    style: 'currency',
    currency: 'EUR',
  });

  const body = (
    <div className="flex flex-col gap-3">
      <p>{t('body', { amount: currencyFormatter.format(totalCents / 100) })}</p>
      <p className="text-[13px] text-[#8c8577]">{t('warning')}</p>
    </div>
  );

  return (
    <ConfirmDialog
      open={open}
      onCancel={onCancel}
      onConfirm={onConfirm}
      title={t('title')}
      body={body}
      confirmLabel={t('confirm')}
      cancelLabel={t('back')}
      pending={pending}
    />
  );
}
