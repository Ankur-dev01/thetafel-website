// components/consumer/booking/DatePicker.tsx
//
// Month-grid calendar. Mondays-first (NL + EN convention). Day-of-week
// labels and month names come from Intl, not hardcoded translations.
//
// A cell is selectable when ALL of:
//   - date >= minDate (today, Europe/Amsterdam)
//   - date <= maxDate (today + bookingWindowDays)
//   - ISO day-of-week is in openDaysOfWeek
// Otherwise it renders muted and non-interactive.

'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

interface Props {
  /** YYYY-MM-DD or null. */
  selectedDate: string | null;
  /** Called with YYYY-MM-DD when the user picks a day. */
  onSelect: (date: string) => void;
  /** Inclusive minimum bookable date (YYYY-MM-DD, Europe/Amsterdam). */
  minDate: string;
  /** Inclusive maximum bookable date (YYYY-MM-DD, Europe/Amsterdam). */
  maxDate: string;
  /** ISO weekdays the restaurant accepts reservations on (1=Mon .. 7=Sun). */
  openDaysOfWeek: number[];
  /** 'nl' or 'en' — used for day & month labels via Intl. */
  locale: string;
}

interface CellMeta {
  date: string;
  inMonth: boolean;
  isPast: boolean;
  isFuture: boolean;
  isClosed: boolean;
  isSelectable: boolean;
  isToday: boolean;
}

export function DatePicker({
  selectedDate,
  onSelect,
  minDate,
  maxDate,
  openDaysOfWeek,
  locale,
}: Props) {
  const t = useTranslations('booking.r1');
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  const [visibleYM, setVisibleYM] = useState<{ year: number; month: number }>(() => {
    const [y, m] = minDate.split('-').map(Number);
    return { year: y, month: m };
  });

  const monthLabel = useMemo(() => {
    const probe = new Date(Date.UTC(visibleYM.year, visibleYM.month - 1, 1));
    return new Intl.DateTimeFormat(locale, {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'long',
    }).format(probe);
  }, [visibleYM, locale]);

  const dayHeaders = useMemo(() => buildIsoDayHeaders(locale), [locale]);

  const cells = useMemo(
    () => buildMonthGrid(visibleYM, minDate, maxDate, openDaysOfWeek),
    [visibleYM, minDate, maxDate, openDaysOfWeek],
  );

  const canPrev = isMonthAfter(visibleYM, monthOf(minDate));
  const canNext = isMonthBefore(visibleYM, monthOf(maxDate));

  function step(delta: -1 | 1) {
    setVisibleYM((cur) => {
      const d = new Date(Date.UTC(cur.year, cur.month - 1 + delta, 1));
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
    });
  }

  const navBtnStyle = (disabled: boolean): React.CSSProperties => ({
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    border: 'none',
    background: 'transparent',
    cursor: disabled ? 'not-allowed' : 'pointer',
    color: disabled ? 'rgba(15, 13, 8, 0.2)' : 'rgba(15, 13, 8, 0.6)',
    padding: 0,
    transition: 'background 0.1s ease, color 0.1s ease',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <button
          type="button"
          onClick={() => canPrev && step(-1)}
          disabled={!canPrev}
          aria-label={t('prev_month')}
          style={navBtnStyle(!canPrev)}
        >
          <ChevronIcon direction="left" />
        </button>
        <div
          aria-live="polite"
          style={{
            fontFamily: 'var(--font-raleway), serif',
            fontWeight: 900,
            fontSize: 15,
            color: 'var(--night, #0f0d08)',
            textTransform: 'capitalize',
            letterSpacing: '-0.01em',
          }}
        >
          {monthLabel}
        </div>
        <button
          type="button"
          onClick={() => canNext && step(1)}
          disabled={!canNext}
          aria-label={t('next_month')}
          style={navBtnStyle(!canNext)}
        >
          <ChevronIcon direction="right" />
        </button>
      </div>

      {/* Day headers (Mon..Sun) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 4,
          textAlign: 'center',
        }}
      >
        {dayHeaders.map((label, i) => (
          <div
            key={i}
            style={{
              fontSize: 10,
              fontFamily: 'var(--font-jost), sans-serif',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'rgba(15, 13, 8, 0.35)',
              padding: '4px 0',
            }}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {cells.map((cell) => {
          if (!cell.inMonth) {
            return <div key={cell.date} aria-hidden="true" style={{ height: 40 }} />;
          }

          const isSelected = cell.date === selectedDate;
          const isHovered = cell.date === hoveredDate && cell.isSelectable;
          const day = Number(cell.date.slice(-2));

          if (cell.isSelectable) {
            let bg = 'transparent';
            let color = 'var(--night, #0f0d08)';
            let border = '1px solid transparent';

            if (isSelected) {
              bg = 'var(--amber, #d4820a)';
              color = '#fff';
              border = '1px solid transparent';
            } else if (cell.isToday) {
              bg = isHovered ? 'rgba(212, 130, 10, 0.1)' : 'transparent';
              border = '1px solid rgba(212, 130, 10, 0.5)';
            } else if (isHovered) {
              bg = 'rgba(15, 13, 8, 0.05)';
            }

            return (
              <button
                key={cell.date}
                type="button"
                onClick={() => onSelect(cell.date)}
                onMouseEnter={() => setHoveredDate(cell.date)}
                onMouseLeave={() => setHoveredDate(null)}
                aria-pressed={isSelected}
                style={{
                  height: 40,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 6,
                  border,
                  background: bg,
                  color,
                  fontSize: 14,
                  fontFamily: 'var(--font-jost), sans-serif',
                  fontWeight: isSelected ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'background 0.1s ease, border-color 0.1s ease',
                  padding: 0,
                }}
              >
                {day}
              </button>
            );
          }

          return (
            <div
              key={cell.date}
              aria-disabled="true"
              title={cell.isClosed ? t('closed_day') : undefined}
              style={{
                height: 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 6,
                fontSize: 14,
                fontFamily: 'var(--font-jost), sans-serif',
                color: 'rgba(15, 13, 8, 0.2)',
                cursor: 'not-allowed',
                userSelect: 'none',
              }}
            >
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function buildIsoDayHeaders(locale: string): string[] {
  // 2024-01-01 was a Monday; iterate 7 days starting from that Monday.
  const dtf = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: 'short' });
  return Array.from({ length: 7 }, (_, i) => dtf.format(new Date(Date.UTC(2024, 0, 1 + i))));
}

function buildMonthGrid(
  ym: { year: number; month: number },
  minDate: string,
  maxDate: string,
  openDays: number[],
): CellMeta[] {
  const firstOfMonth = new Date(Date.UTC(ym.year, ym.month - 1, 1));
  // ISO day of week for the 1st (1=Mon..7=Sun)
  const isoDow = ((firstOfMonth.getUTCDay() + 6) % 7) + 1;
  const gridStart = new Date(firstOfMonth);
  gridStart.setUTCDate(firstOfMonth.getUTCDate() - (isoDow - 1));

  const todayLocal = todayInAmsterdam();
  const openSet = new Set(openDays);
  const out: CellMeta[] = [];

  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setUTCDate(gridStart.getUTCDate() + i);
    const ymd = d.toISOString().slice(0, 10);
    const inMonth = d.getUTCFullYear() === ym.year && d.getUTCMonth() === ym.month - 1;
    const isPast = ymd < minDate;
    const isFuture = ymd > maxDate;
    const dayOfWeek = ((d.getUTCDay() + 6) % 7) + 1;
    const isClosed = !openSet.has(dayOfWeek);
    out.push({
      date: ymd,
      inMonth,
      isPast,
      isFuture,
      isClosed,
      isSelectable: inMonth && !isPast && !isFuture && !isClosed,
      isToday: ymd === todayLocal,
    });
  }
  return out;
}

function todayInAmsterdam(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function monthOf(dateLocal: string): { year: number; month: number } {
  const [y, m] = dateLocal.split('-').map(Number);
  return { year: y, month: m };
}

function isMonthAfter(a: { year: number; month: number }, b: { year: number; month: number }) {
  return a.year > b.year || (a.year === b.year && a.month > b.month);
}

function isMonthBefore(a: { year: number; month: number }, b: { year: number; month: number }) {
  return a.year < b.year || (a.year === b.year && a.month < b.month);
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {direction === 'left' ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 6l6 6-6 6" />}
    </svg>
  );
}
