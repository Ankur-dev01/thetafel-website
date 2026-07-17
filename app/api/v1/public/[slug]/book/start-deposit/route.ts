// app/api/v1/public/[slug]/book/start-deposit/route.ts
//
// POST /api/v1/public/{slug}/book/start-deposit
//
// Order: rate limit → parse → Zod → Turnstile → config (doorman) →
//   server-recompute deposit applicability + amount → slot lock →
//   re-check availability → insert payment_intents row → call Mollie →
//   update row with mollie id + checkout url → release lock → audit → response
//
// Security: PRD §14.8 (never trust client amount), §9.2 (payment intent
// lifecycle). Verifying the payment actually succeeded is NOT this route's
// job — that happens in the /return/[intentId] handler (a follow-up unit),
// which re-fetches status from Mollie directly and never trusts the redirect.

import { NextResponse, type NextRequest } from 'next/server';
import { startDepositInputSchema } from '@/lib/booking/startDepositSchema';
import { loadBookingConfig } from '@/lib/booking/config';
import { loadAvailabilityInputs } from '@/lib/booking/queries';
import { computeAvailability } from '@/lib/booking/computeAvailability';
import { depositApplies, computeDepositAmountCents } from '@/lib/booking/deposit';
import { acquireSlotLock, releaseSlotLock } from '@/lib/booking/slotLock';
import { createConnectedPayment } from '@/lib/mollie/createConnectedPayment';
import { checkConsumerRateLimit, getCallerIp, redactIp } from '@/lib/consumer/rateLimit';
import { verifyTurnstileToken } from '@/lib/consumer/turnstile';
import { auditLog } from '@/lib/consumer/audit';
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const IDEMPOTENCY_LOOKBACK_MINUTES = 10;

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug: slugParam } = await ctx.params;
  const ip = getCallerIp(req);

  // 1. Rate limit.
  const rl = await checkConsumerRateLimit('deposit_start', ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds ?? 3600) } },
    );
  }

  // 2. Parse + Zod validate.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }
  const parsed = startDepositInputSchema.safeParse(body);
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

  // 3. Turnstile verify.
  const tv = await verifyTurnstileToken(input.turnstileToken, ip);
  if (!tv.ok) {
    return NextResponse.json({ ok: false, error: 'turnstile_failed' }, { status: 403 });
  }

  // 4. Load config — doorman (checks live + reservations enabled).
  const cfgResult = await loadBookingConfig(input.slug);
  if (!cfgResult.ok) {
    return NextResponse.json({ ok: false, error: cfgResult.error }, { status: 200 });
  }
  const config = cfgResult.config;

  // 5. Server-authoritative deposit check. Never trust that the client only
  //    calls this when it should — re-derive from config + input.
  if (!depositApplies(config, input.partySize, input.slotInstant)) {
    return NextResponse.json({ ok: false, error: 'deposit_not_required' }, { status: 409 });
  }
  const amountCents = computeDepositAmountCents(config, input.partySize);
  if (amountCents <= 0) {
    return NextResponse.json({ ok: false, error: 'deposit_not_required' }, { status: 409 });
  }

  const admin = await createSupabaseServerClientAdmin();

  // 6. Idempotency check — a replay within the lookback window returns the
  //    same checkout URL instead of creating a second Mollie payment.
  const { data: existingIntent } = await admin
    .from('payment_intents')
    .select('id, status, metadata, created_at')
    .eq('idempotency_key', input.idempotencyKey)
    .gte(
      'created_at',
      new Date(Date.now() - IDEMPOTENCY_LOOKBACK_MINUTES * 60_000).toISOString(),
    )
    .maybeSingle();

  if (existingIntent) {
    const meta = (existingIntent.metadata ?? {}) as Record<string, unknown>;
    const checkoutUrl = typeof meta.checkoutUrl === 'string' ? meta.checkoutUrl : null;
    if (existingIntent.status === 'pending' && checkoutUrl) {
      return NextResponse.json({ ok: true, intentId: existingIntent.id, checkoutUrl });
    }
    if (existingIntent.status === 'paid') {
      return NextResponse.json({
        ok: true,
        intentId: existingIntent.id,
        checkoutUrl: null,
        alreadyPaid: true,
      });
    }
    // failed/cancelled replay — fall through and create a fresh intent below.
  }

  // 7. Slot lock — serializes concurrent deposit-starts for the same slot.
  //    Same short-critical-section pattern as createBooking (C4.7B critical
  //    pattern: "extend the locked critical section to include the
  //    payment-intent row insert").
  const lock = await acquireSlotLock(config.restaurantId, input.slotInstant);
  if (!lock.ok) {
    return NextResponse.json({ ok: false, error: 'slot_temporarily_busy' }, { status: 409 });
  }

  try {
    // 8. Fresh availability re-check inside the lock.
    const inputs = await loadAvailabilityInputs(config, input.date);
    const avail = computeAvailability(config, inputs, input.partySize);
    const stillAvailable = avail.slots.some((s) => s.instant === input.slotInstant);
    if (!stillAvailable) {
      return NextResponse.json({ ok: false, error: 'slot_no_longer_available' }, { status: 409 });
    }

    // 9. Insert the payment_intents row as 'pending' first, so a Mollie
    //    failure still leaves an auditable trail (never orphan silently).
    const { data: intentRow, error: insertErr } = await admin
      .from('payment_intents')
      .insert({
        restaurant_id: config.restaurantId,
        purpose: 'deposit',
        amount_cents: amountCents,
        currency: config.noShowPrepaidCurrency,
        status: 'pending',
        provider: 'mollie',
        idempotency_key: input.idempotencyKey,
        metadata: {
          slug: input.slug,
          partySize: input.partySize,
          date: input.date,
          slotInstant: input.slotInstant,
          guestEmail: input.guest.email,
          guestName: input.guest.name,
        },
      })
      .select('id')
      .single();

    if (insertErr || !intentRow) {
      console.error('[start-deposit] payment_intents insert failed', insertErr?.message);
      return NextResponse.json({ ok: false, error: 'persistence_failed' }, { status: 500 });
    }
    const intentId = intentRow.id as string;

    // 10. Build redirect + webhook URLs.
    const publicBaseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://thetafel.nl';
    const redirectBaseUrl =
      process.env.NODE_ENV === 'production' ? publicBaseUrl : 'http://localhost:3000';
    const localePrefix = input.locale === 'en' ? '/en' : '';
    const redirectUrl = `${redirectBaseUrl}${localePrefix}/r/${input.slug}/book/return/${intentId}`;
    const webhookUrl = `${publicBaseUrl}/api/webhooks/mollie/consumer`;

    const description =
      input.locale === 'nl'
        ? `Aanbetaling reservering — ${config.displayName ?? config.slug}`
        : `Reservation deposit — ${config.displayName ?? config.slug}`;

    // 11. Call Mollie via the restaurant's connected account. Metadata is the
    //     reverse breadcrumb Mollie stores server-side on the payment — the
    //     anchor for reconciling a Mollie payment back to our system.
    const molliePaymentMetadata = {
      paymentIntentId: intentId,
      restaurantId: config.restaurantId,
      purpose: 'deposit' as const,
    };
    const paymentResult = await createConnectedPayment({
      restaurantId: config.restaurantId,
      amountCents,
      currency: config.noShowPrepaidCurrency,
      description,
      redirectUrl,
      webhookUrl,
      method: input.method,
      metadata: molliePaymentMetadata,
    });

    if (!paymentResult.ok) {
      await admin
        .from('payment_intents')
        .update({ status: 'failed', failed_at: new Date().toISOString() })
        .eq('id', intentId);

      await auditLog({
        restaurantId: config.restaurantId,
        eventType: 'payment.intent_failed',
        eventData: {
          intentId,
          reason: paymentResult.reason,
          message: paymentResult.message ?? null,
          ip_masked: redactIp(ip),
        },
        actorType: 'guest',
        paymentIntentId: intentId,
        ipAddress: ip,
      }).catch(() => {});

      const status = paymentResult.reason === 'not_connected' ? 409 : 502;
      return NextResponse.json({ ok: false, error: `mollie_${paymentResult.reason}` }, { status });
    }

    // 12. Persist the Mollie payment ID + checkout URL.
    await admin
      .from('payment_intents')
      .update({
        provider_payment_id: paymentResult.molliePaymentId,
        metadata: {
          slug: input.slug,
          partySize: input.partySize,
          date: input.date,
          slotInstant: input.slotInstant,
          guestEmail: input.guest.email,
          guestName: input.guest.name,
          checkoutUrl: paymentResult.checkoutUrl,
        },
      })
      .eq('id', intentId);

    await auditLog({
      restaurantId: config.restaurantId,
      eventType: 'payment.intent_created',
      eventData: {
        intentId,
        molliePaymentId: paymentResult.molliePaymentId,
        amountCents,
        method: input.method,
        ip_masked: redactIp(ip),
      },
      actorType: 'guest',
      paymentIntentId: intentId,
      ipAddress: ip,
    }).catch(() => {});

    return NextResponse.json({ ok: true, intentId, checkoutUrl: paymentResult.checkoutUrl });
  } finally {
    await releaseSlotLock(lock.token, config.restaurantId, input.slotInstant);
  }
}
