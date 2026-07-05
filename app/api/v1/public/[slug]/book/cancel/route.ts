// app/api/v1/public/[slug]/book/cancel/route.ts
//
// POST /api/v1/public/{slug}/book/cancel
//
// Order: rate limit → parse → Zod → Turnstile → consume token → doorman →
//   status idempotency check → policy decision → slot lock → transition
//   status → DELETE booking_tables → refund via Mollie if applicable →
//   update payment_intent → release lock → audit → dispatch cancel email

import { NextResponse, type NextRequest } from 'next/server';
import { cancelBookingInputSchema } from '@/lib/consumer/schemas/cancelSchema';
import { consumeBookingMagicLink } from '@/lib/consumer/magicLinks';
import { assertConsumerWriteAllowed } from '@/lib/consumer/guards';
import { decideCancellation } from '@/lib/booking/cancellation';
import { acquireSlotLock, releaseSlotLock } from '@/lib/booking/slotLock';
import { refundConnectedPayment } from '@/lib/mollie/refundConnectedPayment';
import { checkConsumerRateLimit, getCallerIp, redactIp } from '@/lib/consumer/rateLimit';
import { verifyTurnstileToken } from '@/lib/consumer/turnstile';
import { auditLog } from '@/lib/consumer/audit';
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server';
import { sendBookingCancellationNotification } from '@/lib/consumer/notifications/dispatchCancellation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug: slugParam } = await ctx.params;
  const ip = getCallerIp(req);
  const userAgent = req.headers.get('user-agent') ?? null;

  // 1. Rate limit.
  const rl = await checkConsumerRateLimit('booking_cancel', ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds ?? 3600) } },
    );
  }

  // 2. Parse + Zod.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }
  const parsed = cancelBookingInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'invalid_body', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;
  if (input.slug !== slugParam) {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }

  // 3. Turnstile.
  const tv = await verifyTurnstileToken(input.turnstileToken, ip);
  if (!tv.ok) {
    return NextResponse.json({ ok: false, error: 'turnstile_failed' }, { status: 403 });
  }

  // 4. Consume magic link (multi-use for manage — returns booking payload).
  const consumed = await consumeBookingMagicLink({
    token: input.token,
    ipAddress: ip,
    userAgent,
  });
  if (!consumed.ok) {
    return NextResponse.json(
      { ok: false, error: 'invalid_or_expired_token' },
      { status: 403 },
    );
  }
  const b = consumed.payload;

  if (b.restaurantSlug !== slugParam) {
    return NextResponse.json(
      { ok: false, error: 'invalid_or_expired_token' },
      { status: 403 },
    );
  }

  // 5. Doorman on the restaurant.
  const doorman = await assertConsumerWriteAllowed(b.restaurantId, 'booking.cancel');
  if (!doorman.ok) {
    return NextResponse.json(
      { ok: false, error: 'doorman_denied', reason: doorman.reason },
      { status: doorman.httpStatus },
    );
  }

  const admin = await createSupabaseServerClientAdmin();

  // 6. Idempotency — if already cancelled, return success without side effects.
  if (b.status === 'cancelled') {
    return NextResponse.json({
      ok: true,
      alreadyCancelled: true,
      bookingRef: b.bookingRef,
    });
  }

  // 7. Decide refund policy.
  const decision = decideCancellation({
    bookingStatus: b.status,
    slotTimeUtc: new Date(b.slotTime),
    depositAmountCents: b.depositAmountCents,
    depositCurrency: b.depositCurrency,
  });

  if (!decision.cancellable) {
    return NextResponse.json(
      { ok: false, error: 'not_cancellable', reason: decision.reason },
      { status: 409 },
    );
  }

  // 8. Acquire slot lock so a concurrent booking write on the same slot
  //    can't race with our booking_tables DELETE.
  const lock = await acquireSlotLock(b.restaurantId, b.slotTime);
  if (!lock.ok) {
    return NextResponse.json(
      { ok: false, error: 'slot_temporarily_busy' },
      { status: 409 },
    );
  }

  const shouldRefund = decision.withinRefundWindow && decision.refundCents > 0;
  let refundId: string | null = null;
  let refundStatus: 'not_applicable' | 'refunded' | 'refund_failed' = shouldRefund
    ? 'refund_failed'
    : 'not_applicable';

  try {
    // 9. Transition status confirmed → cancelled.
    const { error: statusErr } = await admin
      .from('bookings')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: 'guest',
        cancellation_reason: decision.reason,
      })
      .eq('id', b.bookingId)
      .eq('status', 'confirmed');

    if (statusErr) {
      console.error('[book/cancel] status transition failed', statusErr.message);
      return NextResponse.json(
        { ok: false, error: 'persistence_failed' },
        { status: 500 },
      );
    }

    // 10. Release the table.
    const { error: btErr } = await admin
      .from('booking_tables')
      .delete()
      .eq('booking_id', b.bookingId);
    if (btErr) {
      console.error('[book/cancel] booking_tables delete failed', btErr.message);
      // Non-fatal — the booking is cancelled; the row will be picked up as
      // orphan by a future cleanup pass. Continue.
    }

    // 11. Refund if applicable.
    if (shouldRefund) {
      // Find the deposit payment_intent for this booking.
      const { data: intents } = await admin
        .from('payment_intents')
        .select('id, provider_payment_id, status, refunded_amount_cents, metadata')
        .eq('purpose', 'deposit')
        .eq('status', 'paid')
        .eq('restaurant_id', b.restaurantId)
        .order('created_at', { ascending: false });

      const intent =
        (intents ?? []).find((row) => {
          const meta = (row.metadata ?? {}) as Record<string, unknown>;
          return meta.bookingId === b.bookingId;
        }) ?? null;

      if (intent && intent.provider_payment_id) {
        const refundResult = await refundConnectedPayment({
          restaurantId: b.restaurantId,
          molliePaymentId: intent.provider_payment_id as string,
          amountCents: decision.refundCents,
          currency: decision.refundCurrency,
          description: `Cancellation refund — booking ${b.bookingRef}`,
        });

        if (refundResult.ok) {
          refundId = refundResult.refundId;
          refundStatus = 'refunded';
          await admin
            .from('payment_intents')
            .update({
              status: 'refunded',
              refunded_amount_cents: decision.refundCents,
              refunded_at: new Date().toISOString(),
              metadata: {
                ...(intent.metadata ?? {}),
                refundId,
                refundedForBookingRef: b.bookingRef,
              },
            })
            .eq('id', intent.id);
        } else {
          refundStatus = 'refund_failed';
          console.error(
            '[book/cancel] Mollie refund failed',
            refundResult.reason,
            refundResult.message,
          );
          // Booking stays cancelled; a human resolves the refund manually.
        }
      } else {
        console.error('[book/cancel] no matching paid deposit intent found for booking', {
          bookingId: b.bookingId,
        });
      }
    }

    // 12. Audit.
    await auditLog({
      restaurantId: b.restaurantId,
      eventType: 'booking.cancelled_by_guest',
      eventData: {
        bookingRef: b.bookingRef,
        reason: decision.reason,
        refundStatus,
        refundCents: decision.refundCents,
        refundId,
        ip_masked: redactIp(ip),
      },
      actorType: 'guest',
      bookingId: b.bookingId,
      ipAddress: ip,
      userAgent,
    }).catch(() => {});

    // 13. Dispatch cancellation email (fire-and-forget — never fail the
    //     cancel because the email couldn't be sent).
    void sendBookingCancellationNotification({
      locale: 'nl',
      guestFullName: b.guestFullName,
      guestEmail: b.guestEmail,
      guestPhone: b.guestPhone,
      restaurantId: b.restaurantId,
      restaurantName: b.restaurantDisplayName ?? 'The Tafel',
      restaurantSlug: b.restaurantSlug,
      bookingId: b.bookingId,
      bookingRef: b.bookingRef,
      slotTime: b.slotTime,
      partySize: b.partySize,
      refundStatus,
      refundCents: decision.refundCents,
      refundCurrency: decision.refundCurrency,
    }).catch((err) => {
      console.error('[book/cancel] cancellation email dispatch failed', err);
    });

    return NextResponse.json({
      ok: true,
      bookingRef: b.bookingRef,
      refundStatus,
      refundCents: decision.refundCents,
      refundCurrency: decision.refundCurrency,
    });
  } finally {
    await releaseSlotLock(lock.token, b.restaurantId, b.slotTime);
  }
}
