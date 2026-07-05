// app/api/v1/public/[slug]/book/[token]/ics/route.ts
//
// GET /api/v1/public/{slug}/book/{token}/ics
//
// Serves a downloadable .ics file for a confirmed booking. The plaintext
// magic-link token in the URL is hashed and matched against the booking's
// magic_link_token_hash. No token consumption — this endpoint is idempotent
// and safe to call any number of times.

import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server';
import { hashMagicLinkToken } from '@/lib/consumer/magicLinks';
import { buildIcs } from '@/lib/booking/icsExport';
import { auditLog } from '@/lib/consumer/audit';
import { getCallerIp, checkConsumerRateLimit } from '@/lib/consumer/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string; token: string }> },
) {
  const { slug, token } = await ctx.params;
  const ip = getCallerIp(req);

  // Light per-IP burst limit — reuses the generous 'availability_query'
  // bucket (60/min) since this isn't a submit-style endpoint.
  const rl = await checkConsumerRateLimit('availability_query', ip);
  if (!rl.allowed) {
    return new NextResponse('Rate limited', { status: 429 });
  }

  if (!slug || !token || token.length < 40) {
    return new NextResponse('Not found', { status: 404 });
  }

  const admin = await createSupabaseServerClientAdmin();
  const tokenHash = hashMagicLinkToken(token);

  const { data: booking, error } = await admin
    .from('bookings')
    .select(`
      id,
      restaurant_id,
      booking_ref,
      slot_time,
      party_size,
      status,
      restaurant:restaurants!inner (
        slug,
        display_name,
        legal_name,
        legal_address_street,
        legal_address_house_number,
        legal_address_postcode,
        legal_address_city
      )
    `)
    .eq('magic_link_token_hash', tokenHash)
    .maybeSingle();

  if (error || !booking) {
    return new NextResponse('Not found', { status: 404 });
  }

  const restaurant = booking.restaurant as unknown as {
    slug: string;
    display_name: string | null;
    legal_name: string | null;
    legal_address_street: string | null;
    legal_address_house_number: string | null;
    legal_address_postcode: string | null;
    legal_address_city: string | null;
  };

  if (restaurant.slug !== slug) {
    return new NextResponse('Not found', { status: 404 });
  }

  // Compute a reasonable default duration. When the C4 config loader is
  // available at this layer we can look it up; for now, 90 minutes is a
  // safe default that matches most restaurants' occupancy_duration.
  const durationMinutes = 90;
  const restaurantName =
    restaurant.display_name || restaurant.legal_name || 'The Tafel';

  const addressParts = [
    [restaurant.legal_address_street, restaurant.legal_address_house_number]
      .filter(Boolean)
      .join(' '),
    [restaurant.legal_address_postcode, restaurant.legal_address_city]
      .filter(Boolean)
      .join(' '),
  ].filter(Boolean);
  const locationLine = addressParts.length > 0 ? addressParts.join(', ') : null;

  const startUtc = new Date(booking.slot_time as string);

  const description =
    `Reservering bij ${restaurantName}\n` +
    `Referentie: ${booking.booking_ref}\n` +
    `Aantal gasten: ${booking.party_size}`;

  const ics = buildIcs({
    uid: `${booking.id}@thetafel.nl`,
    startUtc,
    durationMinutes,
    summary: `Reservering — ${restaurantName}`,
    description,
    location: locationLine,
  });

  // Audit (fire-and-forget).
  void auditLog({
    restaurantId: booking.restaurant_id as string,
    eventType: 'booking.ics_downloaded',
    eventData: { bookingRef: booking.booking_ref },
    actorType: 'guest',
    bookingId: booking.id as string,
    ipAddress: ip,
  }).catch(() => {});

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="thetafel-${booking.booking_ref}.ics"`,
      'Cache-Control': 'no-store',
    },
  });
}
