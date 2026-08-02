'use client';

import { useTranslations } from 'next-intl';
import { VAT_OPTIONS, isAlcoholVatMismatch } from '@/lib/dashboard/menu/vatRates';

type VatPickerProps = {
  value: number;
  onChange: (value: number) => void;
  /** Current tag selection — drives the alcohol warning, live as either side changes. */
  tags: string[];
  disabled?: boolean;
};

export default function VatPicker({ value, onChange, tags, disabled }: VatPickerProps) {
  const t = useTranslations('dashboard.menu.item.field.vat');
  const mismatch = isAlcoholVatMismatch(tags, value);

  return (
    <div>
      <span
        className="block text-[12px] uppercase tracking-[0.08em] text-[#8c8577] mb-1"
        style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
      >
        {t('label')}
      </span>
      <div className="flex gap-2">
        {VAT_OPTIONS.map((option) => (
          <label
            key={option.value}
            className={
              'tafel-tap flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ' +
              (value === option.value ? 'border-amber bg-[#fdf3e0]' : 'border-[#e7ddc9] bg-white')
            }
          >
            <input
              type="radio"
              name="vat-rate"
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              disabled={disabled}
              data-testid={`vat-option-${option.value}`}
              className="w-4 h-4 accent-amber"
            />
            <span className="text-[14px] text-[#1e1508]" style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 500 }}>
              {t(`option.${option.labelKey}`)}
            </span>
          </label>
        ))}
      </div>
      {mismatch && (
        <p className="mt-1.5 text-[12px] text-[#a86205]" data-testid="vat-alcohol-warning">
          {t('warning.alcohol')}
        </p>
      )}
    </div>
  );
}
