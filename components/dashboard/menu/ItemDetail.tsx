'use client';

import { useTranslations } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';
import StatusChip from '@/components/dashboard/ui/StatusChip';
import { Plate } from '@/components/dashboard/icons';
import { formatCents } from '@/lib/dashboard/format/money';
import { formatDateTimeShort } from '@/lib/dashboard/date/amsterdamDay';
import { splitTags } from '@/lib/dashboard/menu/dietaryTags';
import DietaryChip from './DietaryChip';
import AllergenChip from './AllergenChip';
import CategoryWindowChip from './CategoryWindowChip';
import type { MenuItemDetail as MenuItemDetailType } from '@/lib/dashboard/queries/menu';

type ItemDetailProps = {
  item: MenuItemDetailType;
  locale: 'nl' | 'en';
};

export default function ItemDetail({ item, locale }: ItemDetailProps) {
  const t = useTranslations('dashboard.menu');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { allergens, diet } = splitTags(item.dietaryTags);
  const hasWindow = Boolean(item.categoryWindowStart && item.categoryWindowEnd);

  function goToCategory() {
    if (!item.categoryId) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('category', item.categoryId);
    params.delete('item');
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <div className="w-full max-w-[200px] aspect-square rounded-card bg-[#f7f2e9] flex items-center justify-center overflow-hidden">
          {item.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.photoUrl} alt={t('item.placeholderAlt')} className="w-full h-full object-cover" />
          ) : (
            <Plate width={40} height={40} className="text-[#c2b594]" aria-hidden="true" />
          )}
        </div>

        <div className="flex items-start justify-between gap-2">
          <span
            className="text-[20px] text-[#1e1508]"
            style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif', fontWeight: 900 }}
          >
            {item.name}
          </span>
          <span
            className="text-[18px] text-[#1e1508] flex-shrink-0"
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 700 }}
          >
            {formatCents(item.priceCents)}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {diet.map((tag) => (
            <DietaryChip key={tag} tag={tag} />
          ))}
          {allergens.map((code) => (
            <AllergenChip key={code} code={code} />
          ))}
        </div>
      </div>

      {item.description && (
        <div>
          <h3
            className="text-[13px] uppercase tracking-[0.08em] text-[#8c8577] mb-1"
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
          >
            {t('detail.description')}
          </h3>
          <p className="text-[14px] text-[#1e1508] whitespace-pre-line" style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 }}>
            {item.description}
          </p>
        </div>
      )}

      {item.categoryName && (
        <button
          type="button"
          onClick={goToCategory}
          className="tafel-tap self-start text-[13px] text-[#a86205] underline underline-offset-2"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 500 }}
        >
          {t('detail.inCategory', { name: item.categoryName })}
        </button>
      )}

      {!item.available && (
        <div className="bg-[#f0ece3] rounded-lg px-3 py-2.5">
          <StatusChip tone="neutral" label={t('detail.unavailable.title')} />
          <p className="mt-1.5 text-[12px] text-[#8c8577]">{t('detail.unavailable.body')}</p>
        </div>
      )}

      {hasWindow && (
        <div>
          <h3
            className="text-[13px] uppercase tracking-[0.08em] text-[#8c8577] mb-1"
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
          >
            {t('detail.window.title')}
          </h3>
          <div className="flex items-center gap-2 mb-1.5">
            <CategoryWindowChip windowStart={item.categoryWindowStart} windowEnd={item.categoryWindowEnd} />
          </div>
          {item.categoryWindowStart && item.categoryWindowEnd && (
            <p className="text-[13px] text-[#6f6353]">
              {t('detail.window.body', { start: item.categoryWindowStart.slice(0, 5), end: item.categoryWindowEnd.slice(0, 5) })}
            </p>
          )}
        </div>
      )}

      {item.variants.length > 0 && (
        <div>
          <h3
            className="text-[13px] uppercase tracking-[0.08em] text-[#8c8577] mb-2"
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
          >
            {t('detail.modifiers')}
          </h3>
          <div className="flex flex-col gap-1.5">
            {item.variants.map((variant) => (
              <div key={variant.id} className="flex items-center justify-between text-[13px] text-[#1e1508]">
                <span style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 500 }}>{variant.name}</span>
                <span style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}>
                  {variant.priceDeltaCents >= 0 ? '+' : ''}
                  {formatCents(variant.priceDeltaCents)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] text-[#8c8577]">
        {formatDateTimeShort(item.createdAt, locale)} · {formatDateTimeShort(item.updatedAt, locale)}
      </p>

      <div className="flex flex-wrap gap-2 pt-1 border-t border-[#e7ddc9]">
        <button
          type="button"
          disabled
          title={t('detail.action.edit.tooltip')}
          data-testid="menu-item-edit-stub"
          className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-[#f5ede0] text-[#8c8577] opacity-60"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
        >
          {t('detail.action.edit.label')}
        </button>
        <button
          type="button"
          disabled
          title={t('detail.action.toggle86.tooltip')}
          data-testid="menu-item-toggle86-stub"
          className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-[#f5ede0] text-[#8c8577] opacity-60"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
        >
          {t('detail.action.toggle86.label')}
        </button>
        <button
          type="button"
          disabled
          title={t('detail.action.replaceImage.tooltip')}
          data-testid="menu-item-replace-image-stub"
          className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-[#f5ede0] text-[#8c8577] opacity-60"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
        >
          {t('detail.action.replaceImage.label')}
        </button>
      </div>
    </div>
  );
}
