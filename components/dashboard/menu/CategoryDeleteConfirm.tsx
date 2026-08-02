'use client';

import { useTranslations } from 'next-intl';
import ConfirmDialog from '@/components/dashboard/ui/ConfirmDialog';

type CategoryDeleteConfirmProps = {
  open: boolean;
  category: { id: string; name_nl: string };
  /** Server blocks the delete regardless; this only decides which of the two states we render. */
  itemCount: number;
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
};

export default function CategoryDeleteConfirm({
  open,
  category,
  itemCount,
  onCancel,
  onConfirm,
  pending,
}: CategoryDeleteConfirmProps) {
  const t = useTranslations('dashboard.menu.category.delete');

  if (itemCount > 0) {
    return (
      <ConfirmDialog
        open={open}
        onCancel={onCancel}
        onConfirm={onCancel}
        title={t('blocked.title')}
        body={
          <div className="flex flex-col gap-2" data-testid="category-delete-blocked">
            <p>{t('blocked.body', { count: itemCount })}</p>
            <p className="text-[13px] text-[#8c8577]">{t('blocked.hint')}</p>
          </div>
        }
        confirmLabel=""
        cancelLabel={t('blocked.close')}
        hideConfirm
      />
    );
  }

  return (
    <ConfirmDialog
      open={open}
      onCancel={onCancel}
      onConfirm={onConfirm}
      title={t('confirm.title')}
      body={<p data-testid="category-delete-confirm">{t('confirm.body', { name: category.name_nl })}</p>}
      confirmLabel={t('confirm.confirm')}
      cancelLabel={t('confirm.back')}
      destructive
      pending={pending}
    />
  );
}
