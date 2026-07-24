'use client';

import { useMemo } from 'react';
import { useRouter, usePathname } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import DateNav from '@/components/dashboard/ui/DateNav';
import EmptyState from '@/components/dashboard/ui/EmptyState';
import DetailPanel from '@/components/dashboard/ui/DetailPanel';
import DetailSheet from '@/components/dashboard/ui/DetailSheet';
import { Chair } from '@/components/dashboard/icons';
import FilterChips from './FilterChips';
import ServiceGroup from './ServiceGroup';
import BookingDetail from './BookingDetail';
import type {
  DayBooking,
  ServiceWindow,
  ServiceGroupKey,
  BookingDetailPayload,
} from '@/lib/dashboard/bookings/types';
import { resolveServiceGroup } from '@/lib/dashboard/bookings/serviceGroup';
import { amsterdamCivilDate } from '@/lib/dashboard/date/amsterdamDay';
import {
  matchesFilter,
  countByFilter,
  parseFilterParam,
  type BookingFilterKey,
} from '@/lib/dashboard/bookings/filters';

const GROUP_ORDER: ServiceGroupKey[] = ['brunch', 'lunch', 'dinner', 'other'];

type BookingsClientProps = {
  civilDate: string;
  windows: ServiceWindow[];
  bookings: DayBooking[];
  selectedBookingDetail: BookingDetailPayload | null;
  locale: 'nl' | 'en';
};

// Local (browser) date construction/formatting — DELIBERATELY not UTC.
// DateNav's own isToday/addDays math (lib: components/dashboard/ui/DateNav.tsx)
// works in the browser's local timezone via setHours/getDate, so these two
// helpers must match that convention or "today" and "+1 day" drift by a day
// whenever local time isn't UTC (this broke the Vandaag button — D2.1 fix).
function parseCivilDate(civilDate: string): Date {
  const [y, m, d] = civilDate.split('-').map(Number);
  const date = new Date();
  date.setFullYear(y, m - 1, d);
  date.setHours(0, 0, 0, 0);
  return date;
}

function toCivilDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function BookingsClient({
  civilDate,
  windows,
  bookings,
  selectedBookingDetail,
  locale,
}: BookingsClientProps) {
  const t = useTranslations('dashboard.bookings');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filter = parseFilterParam(searchParams.get('filter'));
  const now = useMemo(() => new Date(), []);

  const today = useMemo(() => amsterdamCivilDate(new Date()), []);

  const minDate = useMemo(() => {
    const d = parseCivilDate(today);
    d.setDate(d.getDate() - 30);
    return d;
  }, [today]);
  const maxDate = useMemo(() => {
    const d = parseCivilDate(today);
    d.setDate(d.getDate() + 90);
    return d;
  }, [today]);

  function pushParams(next: { date?: string; filter?: BookingFilterKey | null }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.date !== undefined) params.set('date', next.date);
    if (next.filter !== undefined) {
      if (next.filter === null) params.delete('filter');
      else params.set('filter', next.filter);
    }
    params.delete('booking');
    router.push(`${pathname}?${params.toString()}`);
  }

  function closeDetail() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('booking');
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const filteredBookings = useMemo(
    () => bookings.filter((b) => matchesFilter(b, filter, now)),
    [bookings, filter, now]
  );

  const counts = useMemo(() => countByFilter(bookings, now), [bookings, now]);

  const grouped = useMemo(() => {
    const groups: Record<ServiceGroupKey, DayBooking[]> = {
      brunch: [],
      lunch: [],
      dinner: [],
      other: [],
    };
    for (const booking of filteredBookings) {
      const key = resolveServiceGroup(booking.slot_time, windows);
      groups[key].push(booking);
    }
    return groups;
  }, [filteredBookings, windows]);

  const hasAnyGroupedBookings = GROUP_ORDER.some((key) => grouped[key].length > 0);

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <DateNav
          date={parseCivilDate(civilDate)}
          onChange={(d) => pushParams({ date: toCivilDateString(d) })}
          min={minDate}
          max={maxDate}
          locale={locale}
        />
        <FilterChips
          value={filter}
          onChange={(next) => pushParams({ filter: next })}
          counts={counts}
        />
      </div>

      <div className={selectedBookingDetail ? 'grid md:grid-cols-[60%_40%] gap-4 items-start' : ''}>
        <div className="flex flex-col gap-5">
          {!hasAnyGroupedBookings ? (
            bookings.length === 0 ? (
              <EmptyState
                illustration={<Chair width={48} height={48} />}
                heading={t('empty.day')}
              />
            ) : (
              <EmptyState
                illustration={<Chair width={48} height={48} />}
                heading={t('empty.filter')}
                action={
                  <button
                    type="button"
                    onClick={() => pushParams({ filter: null })}
                    className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-amber text-[#1e1508]"
                    style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
                  >
                    {t('empty.showAll')}
                  </button>
                }
              />
            )
          ) : (
            GROUP_ORDER.map((key) => (
              <ServiceGroup key={key} groupKey={key} bookings={grouped[key]} />
            ))
          )}
        </div>

        {selectedBookingDetail && (
          <>
            <div className="hidden md:block">
              <DetailPanel
                title={
                  selectedBookingDetail.booking.guest_anonymised
                    ? t('anonymisedGuest')
                    : selectedBookingDetail.booking.guest_name || '—'
                }
              >
                <BookingDetail payload={selectedBookingDetail} locale={locale} />
              </DetailPanel>
            </div>
            <div className="md:hidden">
              <DetailSheet
                open
                onClose={closeDetail}
                title={
                  selectedBookingDetail.booking.guest_anonymised
                    ? t('anonymisedGuest')
                    : selectedBookingDetail.booking.guest_name || '—'
                }
              >
                <BookingDetail payload={selectedBookingDetail} locale={locale} />
              </DetailSheet>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
