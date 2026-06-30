// app/[locale]/r/[slug]/book/confirmed/page.tsx
//
// Minimal confirmation page. Reads ?ref=<booking_ref>&t=<plaintext magic link token>.
// Token lookup goes through the magic_links table (JOIN bookings + guests).
// Ref-only fallback for idempotent replays where the client lost the token.
//
// Polished design + cancel/manage controls land in C4.8.

import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server';
import { hashMagicLinkToken } from '@/lib/consumer/magicLinks';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ ref?: string; t?: string }>;
}

export default async function BookingConfirmedPage({ params, searchParams }: PageProps) {
  const { locale, slug } = await params;
  const { ref, t: token } = await searchParams;
  const tr = await getTranslations({ locale, namespace: 'booking.confirmed' });

  let booking: BookingDisplay | null = null;
  if (token) {
    booking = await loadBookingByToken(slug, token);
  }
  if (!booking && ref) {
    booking = await loadBookingByRef(slug, ref);
  }

  const localeStr = locale === 'nl' ? 'nl' : 'en';
  const backHref = locale === 'nl' ? `/r/${slug}` : `/${locale}/r/${slug}`;

  if (!booking) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <h1 className="font-display text-2xl text-night sm:text-3xl">{tr('not_found_title')}</h1>
        <p className="text-sm text-night/70">{tr('not_found_body')}</p>
        <Link href={backHref} className="mt-2 text-sm text-amber underline-offset-2 hover:underline">
          {tr('back_to_restaurant')}
        </Link>
      </div>
    );
  }

  const slotLabel = new Intl.DateTimeFormat(localeStr, {
    timeZone: 'Europe/Amsterdam',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(booking.slot_time));

  return (
    <div className="flex flex-col gap-6 py-8 sm:py-12">
      <div className="flex flex-col items-start gap-2">
        <span className="text-xs uppercase tracking-wider text-amber">{tr('eyebrow')}</span>
        <h1 className="font-display text-3xl text-night sm:text-4xl">{tr('heading')}</h1>
        <p className="text-base text-night/70">{tr('subhead', { email: booking.guest_email })}</p>
      </div>

      <div className="rounded-md bg-white/60 p-6 sm:p-8">
        <div className="flex flex-col gap-3">
          <Row label={tr('label_ref')} value={booking.booking_ref} />
          <Row label={tr('label_when')} value={slotLabel} />
          <Row label={tr('label_party')} value={String(booking.party_size)} />
          {booking.guest_note && (
            <Row label={tr('label_notes')} value={booking.guest_note} multiline />
          )}
        </div>
      </div>

      <Link href={backHref} className="text-sm text-amber underline-offset-2 hover:underline">
        {tr('back_to_restaurant')}
      </Link>
    </div>
  );
}

function Row({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-wider text-night/50">{label}</span>
      <span className={['text-sm text-night', multiline ? 'whitespace-pre-line' : ''].join(' ')}>
        {value}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Data loaders                                                               */
/* -------------------------------------------------------------------------- */

interface BookingDisplay {
  booking_ref: string;
  slot_time: string;
  party_size: number;
  guest_email: string;
  guest_note: string | null;
}

async function loadBookingByToken(slug: string, plaintext: string): Promise<BookingDisplay | null> {
  const supabase = await createSupabaseServerClientAdmin();
  const hash = hashMagicLinkToken(plaintext);

  // Query via magic_links table — the token hash is stored there, not on bookings.
  const { data, error } = await supabase
    .from('magic_links')
    .select(
      `token_hash,
       bookings!inner(
         booking_ref, slot_time, party_size, guest_note,
         restaurants!inner(slug),
         guests!inner(email)
       )`,
    )
    .eq('token_hash', hash)
    .eq('bookings.restaurants.slug', slug)
    .maybeSingle();

  if (error || !data) return null;

  const b = (data as unknown as { bookings: { booking_ref: string; slot_time: string; party_size: number; guest_note: string | null; guests: { email: string } } }).bookings;
  if (!b) return null;

  return {
    booking_ref: b.booking_ref,
    slot_time: b.slot_time,
    party_size: b.party_size,
    guest_email: b.guests.email,
    guest_note: b.guest_note,
  };
}

async function loadBookingByRef(slug: string, ref: string): Promise<BookingDisplay | null> {
  const supabase = await createSupabaseServerClientAdmin();

  const { data, error } = await supabase
    .from('bookings')
    .select(
      `booking_ref, slot_time, party_size, guest_note,
       restaurants!inner(slug),
       guests!inner(email)`,
    )
    .eq('booking_ref', ref)
    .eq('restaurants.slug', slug)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as unknown as {
    booking_ref: string;
    slot_time: string;
    party_size: number;
    guest_note: string | null;
    guests: { email: string };
  };

  return {
    booking_ref: row.booking_ref,
    slot_time: row.slot_time,
    party_size: row.party_size,
    guest_email: row.guests.email,
    guest_note: row.guest_note,
  };
}
