'use client';

import { DragHandle } from '@/components/dashboard/icons';
import CategoryWindowChip from './CategoryWindowChip';
import type { MenuCategory } from '@/lib/dashboard/queries/menu';

type CategoryItemProps = {
  category: MenuCategory;
  active: boolean;
  onClick: () => void;
};

export default function CategoryItem({ category, active, onClick }: CategoryItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`menu-category-${category.id}`}
      className={
        'tafel-tap w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-colors border-l-[3px] ' +
        (active ? 'bg-white border-amber' : 'bg-transparent border-transparent hover:bg-white/60')
      }
    >
      <DragHandle width={14} height={14} className="text-[#c2b594] flex-shrink-0" aria-hidden="true" />
      <span
        className={'flex-1 min-w-0 truncate text-[14px] ' + (active ? 'text-[#1e1508]' : 'text-[#6f6353]')}
        style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
      >
        {category.name}
        <span className="ml-1.5 text-[#8c8577] font-normal">({category.itemCount})</span>
      </span>
      <CategoryWindowChip windowStart={category.windowStart} windowEnd={category.windowEnd} />
    </button>
  );
}
