// app/[locale]/r/[slug]/book/confirmed/page.tsx
//
// Confirmation screen after a successful booking.
//
// Reads ?ref=<booking_ref>&t=<plaintext magic link token>.
// Loads the booking row by hashing the token and matching magic_link_token_hash.
// Falls back to a ref-only lookup for idempotent replays where the client
// lost the token (still safe — no PII rendered without the token).

import Link from 'next/link';
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server';
import { hashMagicLinkToken } from '@/lib/consumer/magicLinks';
import { StepR7 } from '@/components/consumer/booking/StepR7';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ ref?: string; t?: string }>;
}

type LoadedBooking = {
  restaurantSlug: string;
  restaurantDisplayName: string;
  restaurantAddressLine: string | null;
  restaurantPhone: string | null;
  bookingRef: string;
  slotStartUtc: Date;
  partySize: number;
  durationMinutes: number;
  depositAmountCents: number | null;
  depositCurrency: string | null;
  magicLinkToken: string;
};

export default async function BookingConfirmedPage({ params, searchParams }: PageProps) {
  const { locale: localeParam, slug } = await params;
  const { ref, t: token } = await searchParams;
  const locale: 'nl' | 'en' = localeParam === 'en' ? 'en' : 'nl';

  const booking = token
    ? await loadBookingByToken(slug, token)
    : ref
      ? await loadBookingByRef(slug, ref)
      : null;

  if (!booking) {
    return <NotFoundState locale={locale} slug={slug} />;
  }

  return (
    <main className="min-h-screen bg-cream">
      <StepR7
        data={{
          locale,
          restaurant: {
            slug: booking.restaurantSlug,
            displayName: booking.restaurantDisplayName,
            addressLine: booking.restaurantAddressLine,
            phone: booking.restaurantPhone,
          },
          booking: {
            ref: booking.bookingRef,
            slotStartUtc: booking.slotStartUtc,
            partySize: booking.partySize,
            durationMinutes: booking.durationMinutes,
            depositAmountCents: booking.depositAmountCents,
            depositCurrency: booking.depositCurrency,
            magicLinkToken: booking.magicLinkToken,
          },
        }}
      />
    </main>
  );
}

async function loadBookingByToken(slug: string, token: string): Promise<LoadedBooking | null> {
  if (!token || token.length < 40) return null;
  const admin = await createSupabaseServerClientAdmin();
  const tokenHash = hashMagicLinkToken(token);

  const { data, error } = await admin
    .from('bookings')
    .select(`
      id,
      restaurant_id,
      booking_ref,
      slot_time,
      party_size,
      deposit_amount_cents,
      deposit_currency,
      restaurant:restaurants!inner (
        slug,
        display_name,
        legal_name,
        contact_phone,
        legal_address_street,
        legal_address_house_number,
        legal_address_postcode,
        legal_address_city,
        occupancy_duration_minutes
      )
    `)
    .eq('magic_link_token_hash', tokenHash)
    .maybeSingle();

  if (error || !data) return null;

  const restaurant = data.restaurant as unknown as {
    slug: string;
    display_name: string | null;
    legal_name: string | null;
    contact_phone: string | null;
    legal_address_street: string | null;
    legal_address_house_number: string | null;
    legal_address_postcode: string | null;
    legal_address_city: string | null;
    occupancy_duration_minutes: number | null;
  };

  if (restaurant.slug !== slug) return null;

  return {
    restaurantSlug: restaurant.slug,
    restaurantDisplayName:
      restaurant.display_name || restaurant.legal_name || 'The Tafel',
    restaurantAddressLine: buildAddressLine(restaurant),
    restaurantPhone: restaurant.contact_phone,
    bookingRef: data.booking_ref as string,
    slotStartUtc: new Date(data.slot_time as string),
    partySize: data.party_size as number,
    durationMinutes: restaurant.occupancy_duration_minutes ?? 90,
    depositAmountCents: (data.deposit_amount_cents as number | null) ?? null,
    depositCurrency: (data.deposit_currency as string | null) ?? null,
    magicLinkToken: token,
  };
}

async function loadBookingByRef(slug: string, ref: string): Promise<LoadedBooking | null> {
  // Ref-only fallback returns a booking with an empty magic link token so
  // the calendar buttons and manage link degrade gracefully. Still safe —
  // knowing the ref alone doesn't reveal PII beyond what we render here.
  if (!ref || ref.length < 4) return null;
  const admin = await createSupabaseServerClientAdmin();

  const { data, error } = await admin
    .from('bookings')
    .select(`
      id,
      restaurant_id,
      booking_ref,
      slot_time,
      party_size,
      deposit_amount_cents,
      deposit_currency,
      restaurant:restaurants!inner (
        slug,
        display_name,
        legal_name,
        contact_phone,
        legal_address_street,
        legal_address_house_number,
        legal_address_postcode,
        legal_address_city,
        occupancy_duration_minutes
      )
    `)
    .eq('booking_ref', ref)
    .maybeSingle();

  if (error || !data) return null;

  const restaurant = data.restaurant as unknown as {
    slug: string;
    display_name: string | null;
    legal_name: string | null;
    contact_phone: string | null;
    legal_address_street: string | null;
    legal_address_house_number: string | null;
    legal_address_postcode: string | null;
    legal_address_city: string | null;
    occupancy_duration_minutes: number | null;
  };

  if (restaurant.slug !== slug) return null;

  return {
    restaurantSlug: restaurant.slug,
    restaurantDisplayName:
      restaurant.display_name || restaurant.legal_name || 'The Tafel',
    restaurantAddressLine: buildAddressLine(restaurant),
    restaurantPhone: restaurant.contact_phone,
    bookingRef: data.booking_ref as string,
    slotStartUtc: new Date(data.slot_time as string),
    partySize: data.party_size as number,
    durationMinutes: restaurant.occupancy_duration_minutes ?? 90,
    depositAmountCents: (data.deposit_amount_cents as number | null) ?? null,
    depositCurrency: (data.deposit_currency as string | null) ?? null,
    magicLinkToken: '', // no token available in ref-fallback path
  };
}

function buildAddressLine(r: {
  legal_address_street: string | null;
  legal_address_house_number: string | null;
  legal_address_postcode: string | null;
  legal_address_city: string | null;
}): string | null {
  const parts: string[] = [];
  const streetLine = [r.legal_address_street, r.legal_address_house_number]
    .filter(Boolean)
    .join(' ')
    .trim();
  if (streetLine) parts.push(streetLine);
  const cityLine = [r.legal_address_postcode, r.legal_address_city]
    .filter(Boolean)
    .join(' ')
    .trim();
  if (cityLine) parts.push(cityLine);
  return parts.length > 0 ? parts.join(', ') : null;
}

function NotFoundState({ locale, slug }: { locale: 'nl' | 'en'; slug: string }) {
  const heading =
    locale === 'nl' ? 'Reservering niet gevonden' : 'Booking not found';
  const body =
    locale === 'nl'
      ? 'We konden je reservering niet vinden. Controleer de link uit je bevestigingsmail of neem contact op met het restaurant.'
      : "We couldn't find your booking. Please check the link from your confirmation email or contact the restaurant.";
  const backLabel =
    locale === 'nl' ? 'Terug naar restaurantpagina' : 'Back to restaurant page';
  const backHref = locale === 'nl' ? `/r/${slug}` : `/${locale}/r/${slug}`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream p-6">
      <div className="flex max-w-[480px] flex-col gap-5 text-center">
        <h1 className="font-display text-[clamp(24px,4vw,32px)] font-black text-night">
          {heading}
        </h1>
        <p className="font-body text-[15px] leading-relaxed text-night/70">{body}</p>
        <Link href={backHref} className="font-body text-[15px] font-medium text-amber underline">
          {backLabel}
        </Link>
      </div>
    </main>
  );
}
