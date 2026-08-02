'use client';

import { useTranslations } from 'next-intl';
import { DragHandle, Pencil } from '@/components/dashboard/icons';
import CategoryWindowChip from './CategoryWindowChip';
import type { MenuCategory } from '@/lib/dashboard/queries/menu';

type CategoryItemProps = {
  category: MenuCategory;
  active: boolean;
  onClick: () => void;
  onEdit: () => void;
  dragging: boolean;
  dragOver: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDrop: () => void;
};

export default function CategoryItem({
  category,
  active,
  onClick,
  onEdit,
  dragging,
  dragOver,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
}: CategoryItemProps) {
  const t = useTranslations('dashboard.menu.category');

  // Row is a plain div rather than a button: it hosts a nested edit button,
  // and a button inside a button is invalid HTML. The selectable area is its
  // own button so keyboard users still get real activation semantics.
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      data-testid={`menu-category-row-${category.id}`}
      className={
        'group flex items-center gap-1 pr-1.5 rounded-lg transition-colors border-l-[3px] ' +
        (active ? 'bg-white border-amber' : 'bg-transparent border-transparent hover:bg-white/60') +
        (dragging ? ' opacity-40' : '') +
        (dragOver ? ' ring-2 ring-amber' : '')
      }
    >
      <span className="pl-3 py-2.5 cursor-move text-[#c2b594] flex-shrink-0" aria-hidden="true">
        <DragHandle width={14} height={14} />
      </span>

      <button
        type="button"
        onClick={onClick}
        data-testid={`menu-category-${category.id}`}
        className="tafel-tap flex-1 min-w-0 flex items-center gap-2 py-2.5 text-left"
      >
        <span
          className={'flex-1 min-w-0 truncate text-[14px] ' + (active ? 'text-[#1e1508]' : 'text-[#6f6353]')}
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
        >
          {category.name}
          <span className="ml-1.5 text-[#8c8577] font-normal">({category.itemCount})</span>
        </span>
        <CategoryWindowChip windowStart={category.windowStart} windowEnd={category.windowEnd} />
      </button>

      <button
        type="button"
        onClick={onEdit}
        title={t('edit.title')}
        aria-label={t('edit.title')}
        data-testid={`menu-category-edit-${category.id}`}
        className="tafel-tap p-1.5 rounded text-[#8c8577] hover:text-[#1e1508] hover:bg-[#f0e8d8] transition-colors flex-shrink-0"
      >
        <Pencil width={14} height={14} aria-hidden="true" />
      </button>
    </div>
  );
}
