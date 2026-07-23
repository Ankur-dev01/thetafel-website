import { useTranslations } from 'next-intl';
import BookingRow from './BookingRow';
import type { DayBooking } from '@/lib/dashboard/bookings/types';
import type { ServiceGroupKey } from '@/lib/dashboard/bookings/types';

type ServiceGroupProps = {
  groupKey: ServiceGroupKey;
  bookings: DayBooking[];
};

export default function ServiceGroup({ groupKey, bookings }: ServiceGroupProps) {
  const t = useTranslations('dashboard.bookings.group');

  if (bookings.length === 0) return null;

  return (
    <div>
      <h2
        className="text-[13px] uppercase tracking-[0.12em] text-[#8c8577] mb-2"
        style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
      >
        {t(groupKey)}
      </h2>
      <div className="flex flex-col gap-2.5">
        {bookings.map((booking) => (
          <BookingRow key={booking.id} booking={booking} />
        ))}
      </div>
    </div>
  );
}
