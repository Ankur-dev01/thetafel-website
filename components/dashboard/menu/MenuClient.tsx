'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';
import EmptyState from '@/components/dashboard/ui/EmptyState';
import DetailPanel from '@/components/dashboard/ui/DetailPanel';
import DetailSheet from '@/components/dashboard/ui/DetailSheet';
import { Plate } from '@/components/dashboard/icons';
import MenuSearch from './MenuSearch';
import CategoryList from './CategoryList';
import CategoryEditDialog from './CategoryEditDialog';
import ItemGrid from './ItemGrid';
import ItemDetail from './ItemDetail';
import ItemEditDialog from './ItemEditDialog';
import { useMenuCategoryActions } from '@/lib/dashboard/actions/menuCategoryActions';
import { useMenuItemActions } from '@/lib/dashboard/actions/menuItemActions';
import type { CategoryPatch } from '@/lib/dashboard/menu/categoryValidation';
import type { MenuCategory, MenuItem, MenuItemDetail as MenuItemDetailType } from '@/lib/dashboard/queries/menu';

type DialogState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; initial: CategoryPatch & { id: string; itemCount: number } };

type ItemDialogState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; itemId: string };

type MenuClientProps = {
  categories: MenuCategory[];
  items: MenuItem[];
  unavailableCount: number;
  activeCategoryId: string | null;
  search: string;
  selectedItem: MenuItemDetailType | null;
  locale: 'nl' | 'en';
};

export default function MenuClient({ categories, items, unavailableCount, activeCategoryId, search, selectedItem, locale }: MenuClientProps) {
  const t = useTranslations('dashboard.menu');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const actions = useMenuCategoryActions();
  const itemActions = useMenuItemActions();
  const [dialog, setDialog] = useState<DialogState>({ mode: 'closed' });
  const [itemCreateOpen, setItemCreateOpen] = useState(false);

  // Editing an item is URL-driven (`?item=<id>&edit=1`) rather than local
  // state: the dialog needs the item's variants, which only the server-side
  // detail query loads. Deriving from the URL means the dialog can't open
  // before that data exists, and a refresh mid-edit lands back in the dialog.
  const editingItem = searchParams.get('edit') === '1' ? selectedItem : null;

  function openItemEdit(itemId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('item', itemId);
    params.set('edit', '1');
    router.replace(`${pathname}?${params.toString()}`);
  }

  function closeItemEdit() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('edit');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  async function handleToggle86(item: MenuItem | MenuItemDetailType) {
    await itemActions.toggle86(item.id, !item.available);
  }

  async function handleItemReorder(categoryId: string, orderedIds: string[]): Promise<boolean> {
    const result = await itemActions.reorderItems(categoryId, orderedIds);
    return result.ok;
  }

  function openEdit(category: MenuCategory) {
    setDialog({
      mode: 'edit',
      initial: {
        id: category.id,
        itemCount: category.itemCount,
        name_nl: category.nameNl,
        name_en: category.nameEn,
        window_start: category.windowStart,
        window_end: category.windowEnd,
        visible_takeaway: category.visibleTakeaway,
        visible_qr: category.visibleQr,
      },
    });
  }

  async function handleReorder(orderedIds: string[]): Promise<boolean> {
    const result = await actions.reorderCategories(orderedIds);
    return result.ok;
  }

  function selectCategory(categoryId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('category', categoryId);
    params.delete('item');
    router.replace(`${pathname}?${params.toString()}`);
  }

  function clearSearch() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('q');
    params.delete('item');
    router.replace(`${pathname}?${params.toString()}`);
  }

  function closeDetail() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('item');
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const isSearching = search.trim().length > 0;

  const matchedCategoryIds = useMemo(() => new Set(items.map((i) => i.categoryId).filter((id): id is string => Boolean(id))), [items]);

  const categoryDialog = (
    <CategoryEditDialog
      open={dialog.mode !== 'closed'}
      mode={dialog.mode === 'edit' ? 'edit' : 'create'}
      initial={dialog.mode === 'edit' ? dialog.initial : null}
      onClose={() => setDialog({ mode: 'closed' })}
      onSubmit={(patch) =>
        dialog.mode === 'edit' ? actions.updateCategory(dialog.initial.id, patch) : actions.createCategory(patch)
      }
      onDelete={dialog.mode === 'edit' ? actions.deleteCategory : undefined}
      pending={actions.pending}
    />
  );

  const itemDialog = (
    <ItemEditDialog
      open={itemCreateOpen || editingItem !== null}
      mode={editingItem ? 'edit' : 'create'}
      categories={categories}
      defaultCategoryId={activeCategoryId}
      item={editingItem}
      onClose={() => {
        if (editingItem) closeItemEdit();
        setItemCreateOpen(false);
      }}
      onSubmit={(patch) => (editingItem ? itemActions.updateItem(editingItem.id, patch) : itemActions.createItem(patch))}
      onDelete={editingItem ? itemActions.deleteItem : undefined}
      onVariantsChanged={() => router.refresh()}
      pending={itemActions.pending}
    />
  );

  if (categories.length === 0) {
    return (
      <div className="flex flex-col gap-4 pt-2">
        <MenuSearch initialValue={search} />
        <EmptyState
          illustration={<Plate width={48} height={48} />}
          heading={t('empty.categories.title')}
          body={t('empty.categories.body')}
          action={
            <button
              type="button"
              onClick={() => setDialog({ mode: 'create' })}
              disabled={actions.pending}
              data-testid="menu-category-add"
              className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-amber text-[#1e1508] disabled:opacity-50"
              style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
            >
              {t('category.add.label')}
            </button>
          }
        />
        {categoryDialog}
      </div>
    );
  }

  const itemsSection =
    items.length === 0 ? (
      isSearching ? (
        <EmptyState
          heading={t('search.empty', { q: search })}
          action={
            <button
              type="button"
              onClick={clearSearch}
              data-testid="menu-search-clear"
              className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-amber text-[#1e1508]"
              style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
            >
              {t('search.clear')}
            </button>
          }
        />
      ) : (
        <EmptyState
          heading={t('category.empty')}
          action={
            <button
              type="button"
              onClick={() => setItemCreateOpen(true)}
              disabled={itemActions.pending}
              data-testid="menu-item-add"
              className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-amber text-[#1e1508] disabled:opacity-50"
              style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
            >
              {t('items.add.label')}
            </button>
          }
        />
      )
    ) : (
      <ItemGrid
        items={items}
        categoryId={isSearching ? null : activeCategoryId}
        onAdd={() => setItemCreateOpen(true)}
        onEdit={(item) => openItemEdit(item.id)}
        onToggle86={handleToggle86}
        onReorder={handleItemReorder}
        pending={itemActions.pending}
      />
    );

  return (
    <div className="flex flex-col gap-4 pt-2">
      {unavailableCount > 0 && (
        <div className="self-start px-3 py-1.5 rounded-full bg-[#fdf3e0] text-[#a86205] text-[12px]" style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}>
          {t('stats.unavailable', { count: unavailableCount })}
        </div>
      )}

      <div className="md:hidden flex flex-col gap-3">
        <MenuSearch initialValue={search} />
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => selectCategory(category.id)}
              data-testid={`menu-category-strip-${category.id}`}
              className={
                'tafel-tap flex-shrink-0 px-3.5 py-2 rounded-full text-[13px] whitespace-nowrap transition-colors ' +
                (category.id === activeCategoryId
                  ? 'bg-amber text-[#1e1508]'
                  : isSearching && matchedCategoryIds.has(category.id)
                    ? 'bg-[#fdf3e0] text-[#a86205]'
                    : 'bg-[#f5ede0] text-[#6f6353]')
              }
              style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
            >
              {category.name} ({category.itemCount})
            </button>
          ))}
        </div>
        {itemsSection}
      </div>

      <div className="hidden md:grid md:grid-cols-[280px_1fr] gap-6 items-start">
        <div className="flex flex-col gap-4">
          <MenuSearch initialValue={search} />
          <CategoryList
            categories={categories}
            activeCategoryId={activeCategoryId}
            onSelect={selectCategory}
            onEdit={openEdit}
            onAdd={() => setDialog({ mode: 'create' })}
            onReorder={handleReorder}
            pending={actions.pending}
          />
        </div>
        <div>{itemsSection}</div>
      </div>

      {selectedItem && (
        <>
          <div className="hidden md:block" data-testid="menu-item-detail-desktop">
            <DetailPanel title={selectedItem.name} onClose={closeDetail}>
              <ItemDetail
                item={selectedItem}
                locale={locale}
                onEdit={() => openItemEdit(selectedItem.id)}
                onToggle86={() => handleToggle86(selectedItem)}
                pending={itemActions.pending}
              />
            </DetailPanel>
          </div>
          <div className="md:hidden" data-testid="menu-item-detail-phone">
            <DetailSheet open onClose={closeDetail} title={selectedItem.name}>
              <ItemDetail
                item={selectedItem}
                locale={locale}
                onEdit={() => openItemEdit(selectedItem.id)}
                onToggle86={() => handleToggle86(selectedItem)}
                pending={itemActions.pending}
              />
            </DetailSheet>
          </div>
        </>
      )}

      {categoryDialog}
      {itemDialog}
    </div>
  );
}
