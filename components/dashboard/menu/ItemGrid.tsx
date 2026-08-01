'use client';

import { useTranslations } from 'next-intl';
import ItemCard from './ItemCard';
import type { MenuItem } from '@/lib/dashboard/queries/menu';

type ItemGridProps = {
  items: MenuItem[];
};

export default function ItemGrid({ items }: ItemGridProps) {
  const t = useTranslations('dashboard.menu');

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {items.map((item) => (
          <ItemCard key={item.id} item={item} />
        ))}
      </div>
      <button
        type="button"
        disabled
        title={t('items.add.tooltip')}
        data-testid="menu-item-add-stub"
        className="tafel-tap self-start px-3.5 py-2 rounded-full text-[12px] uppercase tracking-[0.08em] bg-[#f5ede0] text-[#8c8577] opacity-60"
        style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
      >
        {t('items.add.label')}
      </button>
    </div>
  );
}
