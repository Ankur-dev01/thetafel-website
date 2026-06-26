// components/consumer/booking/BookingProgressDots.tsx
//
// Row of N dots. Past + current dots are amber-filled; future dots are
// translucent night. Inline styles match the codebase convention.

interface Props {
  current: number; // 1-indexed
  total: number;
}

export function BookingProgressDots({ current, total }: Props) {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 10 }}
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current}
    >
      {Array.from({ length: total }, (_, i) => {
        const idx = i + 1;
        const isFilled = idx <= current;
        return (
          <span
            key={idx}
            aria-hidden="true"
            style={{
              display: 'block',
              width: 9,
              height: 9,
              borderRadius: '50%',
              backgroundColor: isFilled ? 'var(--amber)' : 'rgba(15, 13, 8, 0.15)',
              transition: 'background-color 0.2s ease',
              flexShrink: 0,
            }}
          />
        );
      })}
    </div>
  );
}
