'use client';

/**
 * DateNav — day-navigator strip for Bookings and Insights.
 * Locale-aware label: "vandaag" / "morgen" / "za 25 jul" (Dutch default).
 */

type DateNavProps = {
  date: Date;
  onChange: (newDate: Date) => void;
  min?: Date;
  max?: Date;
  locale?: 'nl' | 'en';
};

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function addDays(d: Date, days: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + days);
  return c;
}

function dayLabel(date: Date, locale: 'nl' | 'en'): string {
  const today = startOfDay(new Date());
  const target = startOfDay(date);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diffDays === 0) return locale === 'nl' ? 'vandaag' : 'today';
  if (diffDays === 1) return locale === 'nl' ? 'morgen' : 'tomorrow';
  if (diffDays === -1) return locale === 'nl' ? 'gisteren' : 'yesterday';
  return new Intl.DateTimeFormat(locale === 'nl' ? 'nl-NL' : 'en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date);
}

export default function DateNav({
  date,
  onChange,
  min,
  max,
  locale = 'nl',
}: DateNavProps) {
  const current = startOfDay(date);
  const prevDisabled = min ? addDays(current, -1) < startOfDay(min) : false;
  const nextDisabled = max ? addDays(current, 1) > startOfDay(max) : false;
  const isToday = current.getTime() === startOfDay(new Date()).getTime();

  const arrowClass =
    'tafel-tap p-2 rounded-full text-[#1e1508] hover:bg-[#f0e8d8] transition-colors disabled:opacity-40';

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(addDays(current, -1))}
        disabled={prevDisabled}
        className={arrowClass}
        aria-label={locale === 'nl' ? 'Vorige dag' : 'Previous day'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14.6 5.5L8.2 12l6.3 6.4" />
        </svg>
      </button>

      <span
        className="min-w-[110px] text-center text-[15px] text-[#1e1508] capitalize"
        style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 700 }}
      >
        {dayLabel(current, locale)}
      </span>

      <button
        type="button"
        onClick={() => onChange(addDays(current, 1))}
        disabled={nextDisabled}
        className={arrowClass}
        aria-label={locale === 'nl' ? 'Volgende dag' : 'Next day'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9.4 5.6l6.4 6.4-6.3 6.4" />
        </svg>
      </button>

      {!isToday && (
        <button
          type="button"
          onClick={() => onChange(startOfDay(new Date()))}
          className="tafel-tap px-3 py-1.5 rounded-full text-[11px] uppercase tracking-[0.1em] bg-[#f5ede0] text-[#1e1508]"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
        >
          {locale === 'nl' ? 'Vandaag' : 'Today'}
        </button>
      )}
    </div>
  );
}
