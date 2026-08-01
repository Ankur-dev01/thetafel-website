import { useTranslations } from 'next-intl';
import StatusChip from '@/components/dashboard/ui/StatusChip';

const SUCCESS_TAGS = new Set(['vegan', 'vegetarian']);

type DietaryChipProps = {
  tag: string;
};

/** One diet-tag pill (vegan/vegetarian/halal/kosher/gluten_free) — labels reused from consumer.menu.dietTags. */
export default function DietaryChip({ tag }: DietaryChipProps) {
  const t = useTranslations('consumer.menu.dietTags');
  let label: string;
  try {
    label = t(tag);
  } catch {
    label = tag;
  }
  return <StatusChip tone={SUCCESS_TAGS.has(tag) ? 'success' : 'neutral'} label={label} />;
}
