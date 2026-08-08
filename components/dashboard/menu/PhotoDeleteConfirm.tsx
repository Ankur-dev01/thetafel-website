'use client';

import { useTranslations } from 'next-intl';
import ConfirmDialog from '@/components/dashboard/ui/ConfirmDialog';

type PhotoDeleteConfirmProps = {
  open: boolean;
  itemName: string;
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
};

export default function PhotoDeleteConfirm({
  open,
  itemName,
  onCancel,
  onConfirm,
  pending,
}: PhotoDeleteConfirmProps) {
  const t = useTranslations('dashboard.menu.item.photo.delete.confirm');

  const body = (
    <div className="flex flex-col gap-2">
      <p>{t('body', { name: itemName })}</p>
      <p className="text-[13px] text-[#8c8577]">{t('hint')}</p>
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
      destructive
      pending={pending}
    />
  );
}
