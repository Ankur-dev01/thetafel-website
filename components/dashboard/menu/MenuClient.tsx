'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';
import EmptyState from '@/components/dashboard/ui/EmptyState';
import DetailPanel from '@/components/dashboard/ui/DetailPanel';
import DetailSheet from '@/components/dashboard/ui/DetailSheet';
import { Plate } from '@/components/dashboard/icons';
import MenuSearch from './MenuSearch';
import CategoryList from './CategoryList';
import ItemGrid from './ItemGrid';
import ItemDetail from './ItemDetail';
import type { MenuCategory, MenuItem, MenuItemDetail as MenuItemDetailType } from '@/lib/dashboard/queries/menu';

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

  if (categories.length === 0) {
    return (
      <div className="flex flex-col gap-4 pt-2">
        <MenuSearch initialValue={search} />
        <EmptyState illustration={<Plate width={48} height={48} />} heading={t('empty.categories.title')} body={t('empty.categories.body')} />
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
        <EmptyState heading={t('category.empty')} />
      )
    ) : (
      <ItemGrid items={items} />
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
          <CategoryList categories={categories} activeCategoryId={activeCategoryId} onSelect={selectCategory} />
        </div>
        <div>{itemsSection}</div>
      </div>

      {selectedItem && (
        <>
          <div className="hidden md:block" data-testid="menu-item-detail-desktop">
            <DetailPanel title={selectedItem.name}>
              <ItemDetail item={selectedItem} locale={locale} />
            </DetailPanel>
          </div>
          <div className="md:hidden" data-testid="menu-item-detail-phone">
            <DetailSheet open onClose={closeDetail} title={selectedItem.name}>
              <ItemDetail item={selectedItem} locale={locale} />
            </DetailSheet>
          </div>
        </>
      )}
    </div>
  );
}
