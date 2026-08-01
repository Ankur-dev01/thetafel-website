import { useTranslations } from 'next-intl';
import StatusChip from '@/components/dashboard/ui/StatusChip';

type AllergenChipProps = {
  code: string;
};

/** One allergen/spicy pill — labels reused from consumer.menu.allergens (the same ones guests see). */
export default function AllergenChip({ code }: AllergenChipProps) {
  const t = useTranslations('consumer.menu.allergens');
  let label: string;
  try {
    label = t(code);
  } catch {
    label = code;
  }
  return <StatusChip tone="warning" label={label} />;
}
