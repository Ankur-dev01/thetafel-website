'use client';

import { useTranslations } from 'next-intl';
import ConfirmDialog from '@/components/dashboard/ui/ConfirmDialog';

type ItemDeleteConfirmProps = {
  open: boolean;
  item: { id: string; name: string };
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
};

/**
 * Unlike a category (blocked while it holds items), an item is hard-deleted
 * with no guard — so the copy says outright that order history survives,
 * because that is the owner's real question when deleting a dish they've
 * been selling.
 */
export default function ItemDeleteConfirm({ open, item, onCancel, onConfirm, pending }: ItemDeleteConfirmProps) {
  const t = useTranslations('dashboard.menu.item.delete.confirm');

  return (
    <ConfirmDialog
      open={open}
      onCancel={onCancel}
      onConfirm={onConfirm}
      title={t('title')}
      body={<p data-testid="item-delete-confirm">{t('body', { name: item.name })}</p>}
      confirmLabel={t('confirm')}
      cancelLabel={t('back')}
      destructive
      pending={pending}
    />
  );
}
