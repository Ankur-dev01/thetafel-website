'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import CategoryItem from './CategoryItem';
import type { MenuCategory } from '@/lib/dashboard/queries/menu';

type CategoryListProps = {
  categories: MenuCategory[];
  activeCategoryId: string | null;
  onSelect: (categoryId: string) => void;
  onEdit: (category: MenuCategory) => void;
  onAdd: () => void;
  onReorder: (orderedIds: string[]) => Promise<boolean>;
  pending: boolean;
};

/**
 * Vanilla HTML5 drag-and-drop — no drag library. The list is capped at 50
 * categories server-side, and the interaction is a single-axis list reorder,
 * so react-dnd would be a lot of bundle for very little.
 *
 * Accessibility gap, deliberately deferred: reordering is pointer-only.
 * Keyboard users can still create/edit/delete/select, but not reorder. A
 * future polish pass should add arrow-up/down on a focused row (moving the
 * row and firing the same onReorder).
 */
export default function CategoryList({
  categories,
  activeCategoryId,
  onSelect,
  onEdit,
  onAdd,
  onReorder,
  pending,
}: CategoryListProps) {
  const t = useTranslations('dashboard.menu');

  // Local mirror so the drop lands visually before the server round-trip.
  const [order, setOrder] = useState<MenuCategory[]>(categories);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [reorderError, setReorderError] = useState(false);

  // The drop handler reads the drag source from a ref, not from `draggedId`:
  // state updates are batched, so a dragstart and drop landing in the same
  // batch would leave the handler reading a stale null. `draggedId` still
  // exists, but only to drive the drag styling.
  const draggedIdRef = useRef<string | null>(null);

  // Server payload wins whenever it changes (refresh after any mutation).
  useEffect(() => {
    setOrder(categories);
  }, [categories]);

  function handleDragStart(id: string) {
    draggedIdRef.current = id;
    setDraggedId(id);
  }

  function handleDragEnd() {
    draggedIdRef.current = null;
    setDraggedId(null);
    setDragOverId(null);
  }

  function handleDragOver(e: React.DragEvent, overId: string) {
    e.preventDefault();
    const dragged = draggedIdRef.current;
    if (dragged && overId !== dragged) setDragOverId(overId);
  }

  async function handleDrop(targetId: string) {
    const sourceId = draggedIdRef.current;
    draggedIdRef.current = null;
    setDraggedId(null);
    setDragOverId(null);
    if (!sourceId || sourceId === targetId) return;

    const previous = order;
    const next = [...order];
    const from = next.findIndex((c) => c.id === sourceId);
    const to = next.findIndex((c) => c.id === targetId);
    if (from === -1 || to === -1) return;
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);

    setOrder(next);
    setReorderError(false);

    const ok = await onReorder(next.map((c) => c.id));
    if (!ok) {
      setOrder(previous);
      setReorderError(true);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h2
        className="text-[13px] uppercase tracking-[0.08em] text-[#8c8577] px-1"
        style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
      >
        {t('category.list.title')}
      </h2>

      <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-1 md:pb-0">
        {order.map((category) => (
          <div key={category.id} className="flex-shrink-0 md:flex-shrink md:w-full min-w-[220px] md:min-w-0">
            <CategoryItem
              category={category}
              active={category.id === activeCategoryId}
              onClick={() => onSelect(category.id)}
              onEdit={() => onEdit(category)}
              dragging={draggedId === category.id}
              dragOver={dragOverId === category.id}
              onDragStart={() => handleDragStart(category.id)}
              onDragOver={(e) => handleDragOver(e, category.id)}
              onDragEnd={handleDragEnd}
              onDrop={() => handleDrop(category.id)}
            />
          </div>
        ))}
      </div>

      {reorderError && (
        <p className="text-[12px] text-[#b3422f] px-1" data-testid="category-reorder-error">
          {t('category.reorder.error.revert')}
        </p>
      )}

      <button
        type="button"
        onClick={onAdd}
        disabled={pending}
        data-testid="menu-category-add"
        className="tafel-tap px-3 py-2.5 rounded-lg text-[13px] text-left text-[#a86205] hover:bg-white/60 transition-colors disabled:opacity-50"
        style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
      >
        {t('category.add.label')}
      </button>
    </div>
  );
}
