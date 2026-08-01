'use client';

import { useTranslations } from 'next-intl';
import CategoryItem from './CategoryItem';
import type { MenuCategory } from '@/lib/dashboard/queries/menu';

type CategoryListProps = {
  categories: MenuCategory[];
  activeCategoryId: string | null;
  onSelect: (categoryId: string) => void;
};

export default function CategoryList({ categories, activeCategoryId, onSelect }: CategoryListProps) {
  const t = useTranslations('dashboard.menu');

  return (
    <div className="flex flex-col gap-3">
      <h2
        className="text-[13px] uppercase tracking-[0.08em] text-[#8c8577] px-1"
        style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
      >
        {t('category.list.title')}
      </h2>
      <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-1 md:pb-0">
        {categories.map((category) => (
          <div key={category.id} className="flex-shrink-0 md:flex-shrink md:w-full min-w-[220px] md:min-w-0">
            <CategoryItem category={category} active={category.id === activeCategoryId} onClick={() => onSelect(category.id)} />
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled
        title={t('category.add.tooltip')}
        data-testid="menu-category-add-stub"
        className="tafel-tap px-3 py-2.5 rounded-lg text-[13px] text-left text-[#8c8577] opacity-60"
        style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 500 }}
      >
        {t('category.add.label')}
      </button>
    </div>
  );
}
