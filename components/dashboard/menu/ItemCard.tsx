'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';
import StatusChip from '@/components/dashboard/ui/StatusChip';
import { Plate, EyeOff } from '@/components/dashboard/icons';
import { formatCents } from '@/lib/dashboard/format/money';
import { splitTags } from '@/lib/dashboard/menu/dietaryTags';
import DietaryChip from './DietaryChip';
import AllergenChip from './AllergenChip';
import type { MenuItem } from '@/lib/dashboard/queries/menu';

type ItemCardProps = {
  item: MenuItem;
};

export default function ItemCard({ item }: ItemCardProps) {
  const t = useTranslations('dashboard.menu');
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const params = new URLSearchParams(searchParams.toString());
  params.set('item', item.id);
  const href = `${pathname}?${params.toString()}`;

  const { allergens, diet } = splitTags(item.dietaryTags);

  return (
    <Link
      href={href}
      className={'tafel-tap block' + (item.available ? '' : ' opacity-60')}
      data-testid={`menu-item-${item.id}`}
    >
      <div className="bg-white rounded-card p-3 flex gap-3">
        <div className="w-16 h-16 rounded-card bg-[#f7f2e9] flex-shrink-0 flex items-center justify-center overflow-hidden">
          {item.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.photoUrl} alt={t('item.placeholderAlt')} className="w-full h-full object-cover" />
          ) : (
            <Plate width={24} height={24} className="text-[#c2b594]" aria-hidden="true" />
          )}
        </div>

        <div className="min-w-0 flex-1 flex flex-col gap-1">
          <div className="flex items-start justify-between gap-2">
            <span
              className="text-[14px] text-[#1e1508] leading-snug"
              style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
            >
              {item.name}
            </span>
            <span
              className="text-[14px] text-[#1e1508] flex-shrink-0"
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
            {!item.available && <StatusChip tone="neutral" icon={<EyeOff width={12} height={12} />} label={t('item.unavailableChip')} />}
          </div>

          {item.description && (
            <p className="text-[12px] text-[#8c8577] truncate" style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 }}>
              {item.description}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
