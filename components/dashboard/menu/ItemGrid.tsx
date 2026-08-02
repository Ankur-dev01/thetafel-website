'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import ItemCard from './ItemCard';
import type { MenuItem } from '@/lib/dashboard/queries/menu';

type ItemGridProps = {
  items: MenuItem[];
  /** Null while searching across categories — reorder is per-category, so it's disabled then. */
  categoryId: string | null;
  onAdd: () => void;
  onEdit: (item: MenuItem) => void;
  onToggle86: (item: MenuItem) => void;
  onReorder: (categoryId: string, orderedIds: string[]) => Promise<boolean>;
  pending: boolean;
};

/**
 * Same vanilla HTML5 drag-and-drop as CategoryList (D4.2), including the ref
 * for the drag source — React state is batched, so a dragstart and drop in
 * one batch would leave the drop handler reading a stale null.
 *
 * Reorder is only offered when the grid is showing exactly one category:
 * item display_order is scoped to its category, so a cross-category list
 * (search results) has no single ordering to write.
 */
export default function ItemGrid({
  items,
  categoryId,
  onAdd,
  onEdit,
  onToggle86,
  onReorder,
  pending,
}: ItemGridProps) {
  const t = useTranslations('dashboard.menu');

  const [order, setOrder] = useState<MenuItem[]>(items);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [reorderError, setReorderError] = useState(false);
  const draggedIdRef = useRef<string | null>(null);

  useEffect(() => {
    setOrder(items);
  }, [items]);

  const reorderable = Boolean(categoryId);

  function handleDragStart(id: string) {
    if (!reorderable) return;
    draggedIdRef.current = id;
    setDraggedId(id);
  }

  function handleDragEnd() {
    draggedIdRef.current = null;
    setDraggedId(null);
    setDragOverId(null);
  }

  function handleDragOver(e: React.DragEvent, overId: string) {
    if (!reorderable) return;
    e.preventDefault();
    const dragged = draggedIdRef.current;
    if (dragged && overId !== dragged) setDragOverId(overId);
  }

  async function handleDrop(targetId: string) {
    const sourceId = draggedIdRef.current;
    draggedIdRef.current = null;
    setDraggedId(null);
    setDragOverId(null);
    if (!reorderable || !categoryId || !sourceId || sourceId === targetId) return;

    const previous = order;
    const next = [...order];
    const from = next.findIndex((i) => i.id === sourceId);
    const to = next.findIndex((i) => i.id === targetId);
    if (from === -1 || to === -1) return;
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);

    setOrder(next);
    setReorderError(false);

    const ok = await onReorder(categoryId, next.map((i) => i.id));
    if (!ok) {
      setOrder(previous);
      setReorderError(true);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {order.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            onEdit={() => onEdit(item)}
            onToggle86={() => onToggle86(item)}
            pending={pending}
            dragging={draggedId === item.id}
            dragOver={dragOverId === item.id}
            onDragStart={() => handleDragStart(item.id)}
            onDragOver={(e) => handleDragOver(e, item.id)}
            onDragEnd={handleDragEnd}
            onDrop={() => handleDrop(item.id)}
          />
        ))}
      </div>

      {reorderError && (
        <p className="text-[12px] text-[#b3422f]" data-testid="item-reorder-error">
          {t('item.reorder.error.revert')}
        </p>
      )}

      <button
        type="button"
        onClick={onAdd}
        disabled={pending}
        data-testid="menu-item-add"
        className="tafel-tap self-start px-3.5 py-2 rounded-full text-[12px] uppercase tracking-[0.08em] bg-[#f5ede0] text-[#a86205] disabled:opacity-50"
        style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
      >
        {t('items.add.label')}
      </button>
    </div>
  );
}
