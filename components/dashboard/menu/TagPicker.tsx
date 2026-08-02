'use client';

import { useTranslations } from 'next-intl';
import { ALLERGEN_CODES, DIET_CODES } from '@/lib/menu/allergens';
import { normalizeDietaryTags } from '@/lib/dashboard/menu/normalizeTags';

type TagPickerProps = {
  value: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
};

/**
 * Two grouped sections of toggleable chips. Labels reuse the consumer
 * taxonomy translations (consumer.menu.allergens.* / .dietTags.*) so the
 * owner sees exactly the wording guests do.
 *
 * Emits through normalizeDietaryTags, so what leaves here is already deduped
 * and in canonical order — click order never reaches the server.
 */
export default function TagPicker({ value, onChange, disabled }: TagPickerProps) {
  const t = useTranslations('dashboard.menu.item.field.tags');
  const tAllergens = useTranslations('consumer.menu.allergens');
  const tDiet = useTranslations('consumer.menu.dietTags');

  const selected = new Set(value);

  function toggle(code: string) {
    const next = new Set(selected);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    onChange(normalizeDietaryTags([...next]));
  }

  function renderGroup(codes: readonly string[], label: string, translate: (code: string) => string, testidPrefix: string) {
    return (
      <div>
        <span
          className="block text-[11px] uppercase tracking-[0.08em] text-[#8c8577] mb-1.5"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
        >
          {label}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {codes.map((code) => {
            const active = selected.has(code);
            return (
              <button
                key={code}
                type="button"
                onClick={() => toggle(code)}
                disabled={disabled}
                aria-pressed={active}
                data-testid={`${testidPrefix}-${code}`}
                className={
                  'tafel-tap px-2.5 py-1 rounded-full text-[11px] uppercase tracking-[0.08em] transition-colors disabled:opacity-50 ' +
                  (active ? 'bg-amber text-[#1e1508]' : 'bg-[#f0ece3] text-[#8c8577]')
                }
                style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
              >
                {translate(code)}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <span
        className="block text-[12px] uppercase tracking-[0.08em] text-[#8c8577]"
        style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
      >
        {t('label')}
      </span>
      {renderGroup(ALLERGEN_CODES, t('section.allergens'), (c) => tAllergens(c), 'tag-allergen')}
      {renderGroup(DIET_CODES, t('section.diet'), (c) => tDiet(c), 'tag-diet')}
    </div>
  );
}
