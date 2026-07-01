// app/api/consumer/bookings/create/route.ts
//
// POST /api/consumer/bookings/create
//
// Order: rate limit → parse → Zod → Turnstile → config (doorman) → createBooking → dispatcher → audit → response

import { NextResponse, type NextRequest } from 'next/server';
import { createBookingInputSchema } from '@/lib/booking/createBookingSchema';
import { createBooking } from '@/lib/booking/createBooking';
import { loadBookingConfig } from '@/lib/booking/config';
import { checkConsumerRateLimit, getCallerIp, redactIp } from '@/lib/consumer/rateLimit';
import { verifyTurnstileToken } from '@/lib/consumer/turnstile';
import { auditLog } from '@/lib/consumer/audit';
import { sendBookingConfirmationNotification } from '@/lib/consumer/notifications/dispatcher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ip = getCallerIp(req);

  // 1. Rate limit.
  const rl = await checkConsumerRateLimit('booking_submit', ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds ?? 60) } },
    );
  }

  // 2. Parse + Zod validate.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }

  const parsed = createBookingInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'invalid_body', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // 3. Turnstile verify.
  const tv = await verifyTurnstileToken(input.turnstileToken, ip);
  if (!tv.ok) {
    return NextResponse.json({ ok: false, error: 'turnstile_failed' }, { status: 403 });
  }

  // 4. Load config — serves as doorman (checks live + reservations enabled).
  const cfgResult = await loadBookingConfig(input.slug);
  if (!cfgResult.ok) {
    return NextResponse.json({ ok: false, error: cfgResult.error }, { status: 200 });
  }
  const config = cfgResult.config;

  // 5. Create booking.
  const result = await createBooking(input, config);
  if (!result.ok) {
    await auditLog({
      restaurantId: config.restaurantId,
      eventType: 'booking.create.failed',
      eventData: { slug: input.slug, error: result.error, ip_masked: redactIp(ip) },
      actorType: 'guest',
      ipAddress: ip,
    }).catch(() => {});

    // Map error codes to appropriate HTTP status codes so the client can
    // distinguish "try a different slot" (409) from "try again in a moment" (409 with retry)
    // from "our fault" (200 with error body preserved for consumer surfaces).
    const status =
      result.error === 'slot_no_longer_available' || result.error === 'slot_temporarily_busy'
        ? 409
        : 200;

    return NextResponse.json(
      { ok: false, error: result.error, errorDetail: result.errorDetail },
      { status },
    );
  }

  // 6. Dispatch notifications (fire-and-forget errors; dispatcher never throws).
  if (!result.idempotentReplay) {
    const restaurantName =
      config.displayName ?? config.legalName ?? config.slug;
    sendBookingConfirmationNotification({
      locale: input.locale as 'nl' | 'en',
      guestFullName: input.guest.name.trim(),
      guestEmail: input.guest.email.trim(),
      guestPhone: input.guest.phone.trim() || null,
      restaurantId: config.restaurantId,
      restaurantName,
      restaurantSlug: config.slug,
      restaurantPhone: null,
      restaurantAddress: null,
      bookingId: result.bookingId,
      bookingRef: result.bookingRef,
      slotTime: input.slotInstant,
      partySize: input.partySize,
      durationMinutes: result.occupancyMinutes,
      depositAmountCents: null,
      depositCurrency: null,
      magicLinkToken: result.magicLinkPlaintext,
    }).catch((e) => {
      console.error('[booking/create] dispatcher error', { err: String(e) });
    });
  }

  // 7. Audit success.
  auditLog({
    restaurantId: config.restaurantId,
    eventType: result.idempotentReplay ? 'booking.create.replay' : 'booking.create.succeeded',
    eventData: {
      slug: input.slug,
      booking_ref: result.bookingRef,
      booking_id: result.bookingId,
    },
    actorType: 'guest',
    bookingId: result.bookingId,
    ipAddress: ip,
  }).catch(() => {});

  return NextResponse.json(
    {
      ok: true,
      bookingRef: result.bookingRef,
      magicLinkToken: result.magicLinkPlaintext,
    },
    { status: 200 },
  );
}
