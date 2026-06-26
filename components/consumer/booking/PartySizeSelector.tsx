// components/consumer/booking/PartySizeSelector.tsx
//
// Pill row for party size. Sizes 1..max are interactive; `max+` is rendered
// as a permanently-disabled pill that hints at the call-the-restaurant flow.

'use client';

import { useTranslations } from 'next-intl';

interface Props {
  selectedPartySize: number | null;
  /** Highest selectable size (config.maxPartySizeOnline). */
  max: number;
  onSelect: (size: number) => void;
}

export function PartySizeSelector({ selectedPartySize, max, onSelect }: Props) {
  const shared = useTranslations('booking.shared');
  const sizes = Array.from({ length: Math.max(1, max) }, (_, i) => i + 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {sizes.map((n) => {
          const isSelected = n === selectedPartySize;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onSelect(n)}
              aria-pressed={isSelected}
              style={{
                minWidth: 44,
                borderRadius: 100,
                padding: '8px 16px',
                fontSize: 14,
                fontFamily: 'var(--font-jost), sans-serif',
                fontWeight: isSelected ? 600 : 400,
                border: isSelected ? 'none' : '1px solid rgba(156, 139, 106, 0.25)',
                background: isSelected ? 'var(--amber, #d4820a)' : 'rgba(15, 13, 8, 0.04)',
                color: isSelected ? '#fff' : 'var(--night, #0f0d08)',
                cursor: 'pointer',
                transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease',
              }}
            >
              {n}
            </button>
          );
        })}
        {/* Disabled N+ pill */}
        <span
          aria-disabled="true"
          title={shared('contact_restaurant', { max })}
          style={{
            minWidth: 44,
            borderRadius: 100,
            padding: '8px 16px',
            fontSize: 14,
            fontFamily: 'var(--font-jost), sans-serif',
            border: '1px solid rgba(156, 139, 106, 0.15)',
            background: 'rgba(15, 13, 8, 0.03)',
            color: 'rgba(15, 13, 8, 0.25)',
            cursor: 'not-allowed',
            userSelect: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {max}+
        </span>
      </div>
      <p
        style={{
          fontSize: 12,
          color: 'rgba(15, 13, 8, 0.45)',
          fontFamily: 'var(--font-jost), sans-serif',
          margin: 0,
        }}
      >
        {shared('contact_restaurant', { max })}
      </p>
    </div>
  );
}
