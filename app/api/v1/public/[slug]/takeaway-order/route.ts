// app/api/v1/public/[slug]/takeaway-order/route.ts
//
// POST /api/v1/public/{slug}/takeaway-order
//
// Pay-first takeaway. Creates the order (pending), creates the payment
// intent (with metadata.orderId stamped in from the start — same
// order-first-then-intent pattern as the QR order route), calls Mollie
// against the connected org, returns the checkout URL. On the Mollie
// webhook's 'paid' event the order flips to confirmed and the
// confirmation email goes out.

import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { checkConsumerRateLimit, checkEmailPhoneRateLimit, getCallerIp, redactIp } from '@/lib/consumer/rateLimit'
import { verifyTurnstileToken } from '@/lib/consumer/turnstile'
import { auditLog } from '@/lib/consumer/audit'
import { assertConsumerWriteAllowed, rejectionPayload } from '@/lib/consumer/guards'
import { normalizePhone } from '@/lib/consumer/sanitize'
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'
import { createTakeawayOrder } from '@/lib/orders/createTakeawayOrder'
import { createConnectedPayment } from '@/lib/mollie/createConnectedPayment'
import { computeTakeawayOpeningWindow } from '@/lib/takeaway/openingWindow'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  slug: z.string().min(1).max(120),
  locale: z.enum(['nl', 'en']),
  pickupInstant: z.string().datetime(),
  lines: z
    .array(
      z.object({
        menuItemId: z.string().uuid(),
        quantity: z.number().int().min(1).max(50),
        itemNote: z.string().max(200).optional().nullable(),
      }),
    )
    .min(1)
    .max(50),
  guestName: z.string().min(1).max(120),
  guestPhone: z.string().min(6).max(20),
  guestEmail: z.string().email().max(200),
  guestNote: z.string().max(200).optional().nullable(),
  paymentMethod: z.enum(['ideal', 'card']).optional(),
  idempotencyKey: z.string().uuid(),
  turnstileToken: z.string().min(1).max(4096),
})

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug: slugParam } = await ctx.params
  const ip = getCallerIp(req)

  const rl = await checkConsumerRateLimit('order_submit', ip)
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds ?? 60) } },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'invalid_body', issues: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const input = parsed.data
  if (input.slug !== slugParam) {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const perSlugRl = await checkConsumerRateLimit('order_submit', `${slugParam}:takeaway`)
  if (!perSlugRl.allowed) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(perSlugRl.retryAfterSeconds ?? 60) } },
    )
  }

  const tv = await verifyTurnstileToken(input.turnstileToken, ip)
  if (!tv.ok) {
    return NextResponse.json({ ok: false, error: 'turnstile_failed' }, { status: 403 })
  }

  // Normalise phone AFTER Turnstile passes — bad-actor traffic never reaches
  // the normaliser. Shared helper with the booking flow (E.164 output).
  const phoneE164 = normalizePhone(input.guestPhone)
  if (!phoneE164) {
    return NextResponse.json({ ok: false, error: 'invalid_phone' }, { status: 400 })
  }

  const admin = await createSupabaseServerClientAdmin()
  const { data: restaurant } = await admin
    .from('restaurants')
    .select('id, slug, display_name, legal_name, service_takeaway_enabled, takeaway_accepting_orders')
    .eq('slug', input.slug)
    .maybeSingle()
  if (!restaurant) {
    return NextResponse.json({ ok: false, error: 'restaurant_not_found' }, { status: 404 })
  }

  const doorman = await assertConsumerWriteAllowed(restaurant.id, 'order.takeaway.create')
  if (!doorman.ok) {
    return NextResponse.json(rejectionPayload(doorman), { status: doorman.httpStatus })
  }

  // Per-(email, phone) rate limit — catches a single guest identity
  // spamming takeaway orders across rotating IPs.
  const emailPhoneRl = await checkEmailPhoneRateLimit(input.guestEmail, input.guestPhone, 'order')
  if (!emailPhoneRl.allowed) {
    await auditLog({
      restaurantId: restaurant.id,
      eventType: 'rate_limit.email_phone_exceeded',
      eventData: { scope: 'order', retryAfterSeconds: emailPhoneRl.retryAfterSeconds },
      actorType: 'guest',
      ipAddress: ip,
    }).catch(() => {})
    return NextResponse.json(
      { ok: false, error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(emailPhoneRl.retryAfterSeconds ?? 3600) } },
    )
  }

  if (!restaurant.service_takeaway_enabled) {
    return NextResponse.json({ ok: false, error: 'takeaway_disabled' }, { status: 409 })
  }
  if (!restaurant.takeaway_accepting_orders) {
    return NextResponse.json({ ok: false, error: 'not_accepting_orders' }, { status: 409 })
  }

  // Validate pickup time — must fall within the current opening window AND
  // be at least prep_time in the future. Never trust the client's picker.
  const window = await computeTakeawayOpeningWindow(restaurant.id)
  if (window.status === 'unavailable') {
    return NextResponse.json({ ok: false, error: 'not_accepting_orders' }, { status: 409 })
  }
  const pickupMs = new Date(input.pickupInstant).getTime()
  const nowMs = Date.now()
  const minPickupMs = nowMs + window.prepTimeMinutes * 60_000
  const windowCloseMs = new Date(
    window.status === 'open_now' ? window.todayCloseInstant : window.nextCloseInstant,
  ).getTime()
  const windowOpenMs = new Date(
    window.status === 'open_now' ? window.todayOpenInstant : window.nextOpenInstant,
  ).getTime()
  if (pickupMs < Math.max(minPickupMs, windowOpenMs) || pickupMs > windowCloseMs) {
    return NextResponse.json({ ok: false, error: 'pickup_out_of_window' }, { status: 409 })
  }

  const displayName = restaurant.display_name ?? restaurant.legal_name ?? 'Restaurant'

  // ── Create order ─────────────────────────────────────────────────────
  const orderResult = await createTakeawayOrder({
    restaurantId: restaurant.id,
    pickupInstant: input.pickupInstant,
    lines: input.lines,
    guestName: input.guestName,
    guestPhoneE164: phoneE164,
    guestEmail: input.guestEmail,
    guestNote: input.guestNote ?? null,
    idempotencyKey: input.idempotencyKey,
  })

  if (!orderResult.ok) {
    if (orderResult.error === 'items_invalid') {
      return NextResponse.json(
        { ok: false, error: 'items_invalid', rejections: orderResult.rejections },
        { status: 409 },
      )
    }
    if (orderResult.error === 'below_minimum') {
      return NextResponse.json(
        { ok: false, error: 'below_minimum', minOrderCents: orderResult.minOrderCents },
        { status: 409 },
      )
    }
    if (orderResult.error === 'no_items') {
      return NextResponse.json({ ok: false, error: 'no_items' }, { status: 400 })
    }
    const message = 'message' in orderResult ? orderResult.message : undefined
    console.error('[takeaway-order] order creation failed', orderResult.error, message)
    return NextResponse.json({ ok: false, error: 'persistence_failed' }, { status: 500 })
  }

  const localePrefix = input.locale === 'en' ? '/en' : '/nl'
  const viewOrderUrl = `${localePrefix}/r/${input.slug}/order/confirmed/${orderResult.magicLinkPlaintext}`

  if (orderResult.idempotentReplay) {
    return NextResponse.json({
      ok: true,
      orderId: orderResult.orderId,
      orderRef: orderResult.orderRef,
      idempotentReplay: true,
      checkoutUrl: null,
      viewOrderUrl: null,
    })
  }

  await auditLog({
    restaurantId: restaurant.id,
    eventType: 'takeaway.order_submitted',
    eventData: {
      orderId: orderResult.orderId,
      orderRef: orderResult.orderRef,
      totalCents: orderResult.totalCents,
      lineCount: input.lines.length,
      pickupInstant: input.pickupInstant,
      ip_masked: redactIp(ip),
    },
    actorType: 'guest',
    orderId: orderResult.orderId,
    ipAddress: ip,
  }).catch(() => {})

  // ── Create payment intent ────────────────────────────────────────────
  const { data: intent, error: intentErr } = await admin
    .from('payment_intents')
    .insert({
      restaurant_id: restaurant.id,
      purpose: 'takeaway_order' as const,
      amount_cents: orderResult.totalCents,
      currency: orderResult.currency,
      status: 'pending' as const,
      idempotency_key: `takeaway:${orderResult.orderId}`,
      metadata: {
        orderId: orderResult.orderId,
        orderRef: orderResult.orderRef,
        guestId: orderResult.guestId,
      },
    })
    .select('id')
    .single()

  if (intentErr || !intent) {
    console.error('[takeaway-order] intent insert failed', intentErr?.message)
    return NextResponse.json({ ok: false, error: 'persistence_failed' }, { status: 500 })
  }

  await admin.from('orders').update({ payment_intent_id: intent.id }).eq('id', orderResult.orderId)

  const publicBaseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://thetafel.nl'
  const redirectBaseUrl = process.env.NODE_ENV === 'production' ? publicBaseUrl : 'http://localhost:3000'
  const redirectUrl = `${redirectBaseUrl}${viewOrderUrl}`
  const webhookUrl = `${publicBaseUrl}/api/webhooks/mollie/consumer`
  const description =
    input.locale === 'nl'
      ? `Afhaal ${orderResult.orderRef} — ${displayName}`
      : `Pickup ${orderResult.orderRef} — ${displayName}`

  const paymentResult = await createConnectedPayment({
    restaurantId: restaurant.id,
    amountCents: orderResult.totalCents,
    currency: orderResult.currency,
    description,
    redirectUrl,
    webhookUrl,
    method: input.paymentMethod === 'card' ? 'creditcard' : input.paymentMethod,
    metadata: {
      payment_intent_id: intent.id,
      order_id: orderResult.orderId,
      order_ref: orderResult.orderRef,
      restaurant_id: restaurant.id,
    },
  })

  if (!paymentResult.ok) {
    await admin
      .from('payment_intents')
      .update({ status: 'failed', failed_at: new Date().toISOString() })
      .eq('id', intent.id)
    // Note: orders.payment_status has no 'failed' value in its CHECK
    // constraint (orders_payment_status_check) — status='cancelled' alone
    // is what marks the order dead; payment_status stays whatever it was
    // (i.e. 'pending', since no payment ever actually happened).
    await admin
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', orderResult.orderId)
    await auditLog({
      restaurantId: restaurant.id,
      eventType: 'takeaway.order_payment_failed',
      eventData: {
        orderId: orderResult.orderId,
        reason: paymentResult.reason,
        message: paymentResult.message ?? null,
      },
      actorType: 'guest',
      orderId: orderResult.orderId,
      paymentIntentId: intent.id,
      ipAddress: ip,
    }).catch(() => {})
    const status = paymentResult.reason === 'not_connected' ? 409 : 502
    return NextResponse.json({ ok: false, error: `mollie_${paymentResult.reason}` }, { status })
  }

  await admin
    .from('payment_intents')
    .update({
      provider_payment_id: paymentResult.molliePaymentId,
      metadata: {
        orderId: orderResult.orderId,
        orderRef: orderResult.orderRef,
        guestId: orderResult.guestId,
        checkoutUrl: paymentResult.checkoutUrl,
      },
    })
    .eq('id', intent.id)

  await auditLog({
    restaurantId: restaurant.id,
    eventType: 'takeaway.order_payment_initiated',
    eventData: {
      orderId: orderResult.orderId,
      orderRef: orderResult.orderRef,
      intentId: intent.id,
      molliePaymentId: paymentResult.molliePaymentId,
      amountCents: orderResult.totalCents,
    },
    actorType: 'guest',
    orderId: orderResult.orderId,
    paymentIntentId: intent.id,
    ipAddress: ip,
  }).catch(() => {})

  return NextResponse.json({
    ok: true,
    orderId: orderResult.orderId,
    orderRef: orderResult.orderRef,
    checkoutUrl: paymentResult.checkoutUrl,
    viewOrderUrl,
    idempotentReplay: false,
  })
}
