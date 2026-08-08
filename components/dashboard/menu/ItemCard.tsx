'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';
import StatusChip from '@/components/dashboard/ui/StatusChip';
import { Plate, EyeOff, Pencil, DragHandle } from '@/components/dashboard/icons';
import { formatCents } from '@/lib/dashboard/format/money';
import { splitTags } from '@/lib/dashboard/menu/dietaryTags';
import DietaryChip from './DietaryChip';
import AllergenChip from './AllergenChip';
import type { MenuItem } from '@/lib/dashboard/queries/menu';

type ItemCardProps = {
  item: MenuItem;
  onEdit: () => void;
  onToggle86: () => void;
  pending: boolean;
  dragging: boolean;
  dragOver: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDrop: () => void;
};

export default function ItemCard({
  item,
  onEdit,
  onToggle86,
  pending,
  dragging,
  dragOver,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
}: ItemCardProps) {
  const t = useTranslations('dashboard.menu');
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const params = new URLSearchParams(searchParams.toString());
  params.set('item', item.id);
  const href = `${pathname}?${params.toString()}`;

  const { allergens, diet } = splitTags(item.dietaryTags);

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
      data-testid={`menu-item-row-${item.id}`}
      className={
        'bg-white rounded-card p-3 flex gap-3 transition-colors ' +
        (item.available ? '' : 'opacity-60 ') +
        (dragging ? 'opacity-40 ' : '') +
        (dragOver ? 'ring-2 ring-amber' : '')
      }
    >
      <span className="cursor-move text-[#c2b594] flex-shrink-0 self-start pt-1" aria-hidden="true">
        <DragHandle width={14} height={14} />
      </span>

      <Link href={href} className="tafel-tap flex gap-3 min-w-0 flex-1" data-testid={`menu-item-${item.id}`}>
        <div className="w-16 h-16 rounded-card bg-[#f7f2e9] flex-shrink-0 flex items-center justify-center overflow-hidden">
          {/* Thumb first: a 60-item grid pulls 400px renditions instead of
              1200px ones. Falls back to the full image for rows uploaded
              before D4.4, which have no thumb. */}
          {item.photoThumbUrl ?? item.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.photoThumbUrl ?? item.photoUrl!}
              alt={t('item.placeholderAlt')}
              loading="lazy"
              className="w-full h-full object-cover"
            />
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
          </div>

          {item.description && (
            <p className="text-[12px] text-[#8c8577] truncate" style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 }}>
              {item.description}
            </p>
          )}
        </div>
      </Link>

      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        <button
          type="button"
          onClick={onEdit}
          disabled={pending}
          title={t('item.edit.title')}
          aria-label={t('item.edit.title')}
          data-testid={`menu-item-edit-${item.id}`}
          className="tafel-tap p-1.5 rounded text-[#8c8577] hover:text-[#1e1508] hover:bg-[#f0e8d8] transition-colors disabled:opacity-50"
        >
          <Pencil width={14} height={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onToggle86}
          disabled={pending}
          data-testid={`menu-item-toggle86-${item.id}`}
          aria-pressed={!item.available}
          className="tafel-tap disabled:opacity-50"
        >
          {item.available ? (
            <StatusChip tone="neutral" label={t('item.toggle86.markOff')} />
          ) : (
            <StatusChip tone="neutral" icon={<EyeOff width={12} height={12} />} label={t('item.unavailableChip')} />
          )}
        </button>
      </div>
    </div>
  );
}
