// components/consumer/booking/StepR7.tsx
//
// Step R7 — booking confirmation screen.
//
// Server component. Rendered by the /book/confirmed page after a successful
// booking. Shows a big tick, the booking ref, the summary, calendar buttons,
// and a link to the manage page.

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { buildGoogleCalendarUrl } from '@/lib/booking/icsExport';

export type StepR7Data = {
  locale: 'nl' | 'en';
  restaurant: {
    slug: string;
    displayName: string;
    addressLine: string | null;
    phone: string | null;
  };
  booking: {
    ref: string;
    slotStartUtc: Date;
    partySize: number;
    durationMinutes: number;
    depositAmountCents: number | null;
    depositCurrency: string | null;
    magicLinkToken: string;
  };
};

function formatSlotForLocale(d: Date, locale: 'nl' | 'en'): string {
  const dtf = new Intl.DateTimeFormat(locale === 'nl' ? 'nl-NL' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Amsterdam',
  });
  return dtf.format(d);
}

function formatMoney(cents: number, currency: string, locale: 'nl' | 'en'): string {
  return new Intl.NumberFormat(locale === 'nl' ? 'nl-NL' : 'en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export async function StepR7({ data }: { data: StepR7Data }) {
  const t = await getTranslations({ locale: data.locale, namespace: 'booking.r7' });
  const { restaurant, booking } = data;

  const slotStr = formatSlotForLocale(booking.slotStartUtc, data.locale);
  const description =
    data.locale === 'nl'
      ? `Reservering bij ${restaurant.displayName}\nReferentie: ${booking.ref}\nAantal gasten: ${booking.partySize}`
      : `Reservation at ${restaurant.displayName}\nReference: ${booking.ref}\nParty size: ${booking.partySize}`;

  const googleUrl = buildGoogleCalendarUrl({
    startUtc: booking.slotStartUtc,
    durationMinutes: booking.durationMinutes,
    summary:
      data.locale === 'nl'
        ? `Reservering — ${restaurant.displayName}`
        : `Reservation — ${restaurant.displayName}`,
    description,
    location: restaurant.addressLine,
  });

  const icsUrl = `/api/v1/public/${restaurant.slug}/book/${booking.magicLinkToken}/ics`;
  const localePrefix = data.locale === 'en' ? '/en' : '';
  const manageUrl = `${localePrefix}/r/${restaurant.slug}/bookings/manage?t=${booking.magicLinkToken}`;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8 px-6 py-12 sm:py-16">
      {/* Big tick + heading */}
      <div className="flex flex-col items-center gap-5">
        <div
          aria-hidden="true"
          className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#d4820a]"
        >
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fdfaf5"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="5 12 10 17 19 8" />
          </svg>
        </div>

        <h1 className="text-center font-display text-[clamp(28px,5vw,40px)] font-black leading-tight text-[#0f0d08]">
          {t('heading')}
        </h1>

        <p className="max-w-[440px] text-center font-body text-base text-[#0f0d08]/70">
          {t('sub', { restaurant: restaurant.displayName })}
        </p>
      </div>

      {/* Booking ref pill */}
      <div className="flex flex-col items-center gap-2">
        <span className="font-body text-xs font-medium uppercase tracking-wider text-[#0f0d08]/60">
          {t('ref_label')}
        </span>
        <span className="rounded-pill bg-[#f5ede0] px-[18px] py-[10px] font-mono text-xl font-semibold tracking-wide text-[#0f0d08]">
          {booking.ref}
        </span>
      </div>

      {/* Booking summary card */}
      <div className="flex flex-col gap-4 rounded-card bg-warm p-6">
        <SummaryRow label={t('when_label')} value={slotStr} />
        <SummaryRow
          label={t('party_label')}
          value={
            data.locale === 'nl'
              ? `${booking.partySize} personen`
              : `${booking.partySize} guests`
          }
        />
        {restaurant.addressLine && (
          <SummaryRow label={t('where_label')} value={restaurant.addressLine} />
        )}
        {booking.depositAmountCents && booking.depositCurrency && (
          <SummaryRow
            label={t('deposit_label')}
            value={`${formatMoney(booking.depositAmountCents, booking.depositCurrency, data.locale)} ${t('deposit_paid_suffix')}`}
            valueClassName="text-[#d4820a]"
          />
        )}
      </div>

      {/* Calendar buttons */}
      <div className="flex flex-col gap-3">
        <span className="font-body text-[13px] font-medium text-[#0f0d08]/70">
          {t('calendar_label')}
        </span>
        <div className="flex flex-wrap gap-3">
          <a
            href={googleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-w-[140px] rounded-card bg-[#fdfaf5] px-5 py-[14px] text-center font-body text-sm font-medium text-[#0f0d08]"
          >
            {t('calendar_google')}
          </a>
          <a
            href={icsUrl}
            download={`thetafel-${booking.ref}.ics`}
            className="flex-1 min-w-[140px] rounded-card bg-[#fdfaf5] px-5 py-[14px] text-center font-body text-sm font-medium text-[#0f0d08]"
          >
            {t('calendar_apple_outlook')}
          </a>
        </div>
      </div>

      {/* Manage / restaurant links */}
      <div className="flex flex-col gap-3 pt-2">
        <Link
          href={manageUrl}
          className="text-center font-body text-[15px] font-medium text-[#d4820a] underline underline-offset-2"
        >
          {t('manage_link')}
        </Link>
        {restaurant.phone && (
          <p className="text-center font-body text-[13px] text-[#0f0d08]/60">
            {t('contact_prefix')}{' '}
            <a href={`tel:${restaurant.phone.replace(/\s+/g, '')}`} className="text-[#0f0d08] no-underline">
              {restaurant.phone}
            </a>
          </p>
        )}
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-body text-[11px] font-medium uppercase tracking-wide text-[#0f0d08]/55">
        {label}
      </span>
      <span className={`font-body text-base font-medium leading-relaxed text-[#0f0d08] ${valueClassName ?? ''}`}>
        {value}
      </span>
    </div>
  );
}
