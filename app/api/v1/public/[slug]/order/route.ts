// app/api/v1/public/[slug]/order/route.ts
//
// POST /api/v1/public/{slug}/order
//
// Two branches selected by `payMode`:
//   'pay_now'      → create order (pending) + create payment_intents + Mollie payment → return checkout URL
//   'pay_at_table' → create order (confirmed) linked to a tab → return view-order URL
//
// Order of operations:
//   1. Rate limit (order_submit per IP + per (slug,tableId))
//   2. Parse JSON
//   3. Zod validate
//   4. Turnstile verify
//   5. Resolve slug → restaurant
//   6. Doorman (restaurant live + QR service enabled)
//   7. Resolve tableId belongs to restaurant, is_qr_enabled
//   8. Verify pay mode is enabled on this restaurant
//   9. Call createPayNowOrder OR createPayAtTableOrder
//  10. On pay_now: create payment_intents row (with metadata.orderId stamped), call Mollie
//  11. Audit + respond

import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { checkConsumerRateLimit, getCallerIp, redactIp } from '@/lib/consumer/rateLimit'
import { verifyTurnstileToken } from '@/lib/consumer/turnstile'
import { auditLog } from '@/lib/consumer/audit'
import { assertConsumerWriteAllowed, rejectionPayload } from '@/lib/consumer/guards'
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'
import { createPayNowOrder, createPayAtTableOrder } from '@/lib/orders/transactionalInsert'
import { createConnectedPayment } from '@/lib/mollie/createConnectedPayment'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  slug: z.string().min(1).max(120),
  tableId: z.string().uuid(),
  payMode: z.enum(['pay_now', 'pay_at_table']),
  locale: z.enum(['nl', 'en']),
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
  guestNote: z.string().max(200).optional().nullable(),
  paymentMethod: z.enum(['ideal', 'card']).optional(),
  idempotencyKey: z.string().uuid(),
  turnstileToken: z.string().min(1).max(4096),
})

type Body = z.infer<typeof bodySchema>

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug: slugParam } = await ctx.params
  const ip = getCallerIp(req)

  // 1. Rate limit — per IP.
  const rl = await checkConsumerRateLimit('order_submit', ip)
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds ?? 60) } },
    )
  }

  // 2. Parse JSON.
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  // 3. Zod.
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'invalid_body', issues: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const input: Body = parsed.data
  if (input.slug !== slugParam) {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  // 3b. Per-(slug,tableId) rate limit — narrower to catch single-table abuse.
  const perTableRl = await checkConsumerRateLimit('order_submit', `${slugParam}:${input.tableId}`)
  if (!perTableRl.allowed) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(perTableRl.retryAfterSeconds ?? 60) } },
    )
  }

  // 4. Turnstile.
  const tv = await verifyTurnstileToken(input.turnstileToken, ip)
  if (!tv.ok) {
    return NextResponse.json({ ok: false, error: 'turnstile_failed' }, { status: 403 })
  }

  const admin = await createSupabaseServerClientAdmin()

  // 5. Resolve restaurant.
  const { data: restaurant, error: rErr } = await admin
    .from('restaurants')
    .select(
      'id, slug, display_name, legal_name, status, service_qr_enabled, qr_pay_now_enabled, qr_pay_at_table_enabled',
    )
    .eq('slug', input.slug)
    .maybeSingle()
  if (rErr || !restaurant) {
    return NextResponse.json({ ok: false, error: 'restaurant_not_found' }, { status: 404 })
  }

  // 6. Doorman — restaurant live + QR service enabled.
  const doorman = await assertConsumerWriteAllowed(restaurant.id, 'order.qr.create')
  if (!doorman.ok) {
    return NextResponse.json(rejectionPayload(doorman), { status: doorman.httpStatus })
  }

  // 7. Resolve table.
  const { data: table } = await admin
    .from('restaurant_tables')
    .select('id, restaurant_id, label, is_qr_enabled')
    .eq('id', input.tableId)
    .eq('restaurant_id', restaurant.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (!table || !table.is_qr_enabled) {
    return NextResponse.json({ ok: false, error: 'table_not_found' }, { status: 404 })
  }

  // 8. Pay mode enabled?
  if (input.payMode === 'pay_now' && !restaurant.qr_pay_now_enabled) {
    return NextResponse.json({ ok: false, error: 'pay_mode_disabled' }, { status: 409 })
  }
  if (input.payMode === 'pay_at_table' && !restaurant.qr_pay_at_table_enabled) {
    return NextResponse.json({ ok: false, error: 'pay_mode_disabled' }, { status: 409 })
  }

  const displayName = restaurant.display_name ?? restaurant.legal_name ?? 'Restaurant'

  // 9. Create the order row.
  const createInput = {
    restaurantId: restaurant.id,
    tableId: table.id,
    lines: input.lines,
    guestNote: input.guestNote ?? null,
    idempotencyKey: input.idempotencyKey,
  }

  const orderResult =
    input.payMode === 'pay_now'
      ? await createPayNowOrder(createInput)
      : await createPayAtTableOrder(createInput)

  if (!orderResult.ok) {
    if (orderResult.error === 'items_invalid') {
      return NextResponse.json(
        { ok: false, error: 'items_invalid', rejections: orderResult.rejections },
        { status: 409 },
      )
    }
    if (orderResult.error === 'no_items') {
      return NextResponse.json({ ok: false, error: 'no_items' }, { status: 400 })
    }
    if (orderResult.error === 'tab_busy') {
      return NextResponse.json({ ok: false, error: 'tab_busy' }, { status: 409 })
    }
    console.error('[order] order creation failed', orderResult.error, orderResult.message)
    return NextResponse.json({ ok: false, error: 'persistence_failed' }, { status: 500 })
  }

  const localePrefix = input.locale === 'en' ? '/en' : ''
  const viewOrderUrl = `${localePrefix}/r/${input.slug}/qr/order/${orderResult.magicLinkPlaintext}`

  // Idempotent replay: return the existing order without touching Mollie.
  if (orderResult.idempotentReplay) {
    return NextResponse.json({
      ok: true,
      orderId: orderResult.orderId,
      orderRef: orderResult.orderRef,
      payMode: input.payMode,
      // No checkout URL — client already had one from the original response.
      // For pay-at-table, the view URL isn't safe to regenerate (no fresh
      // plaintext token on replay), so point back to the menu instead.
      viewOrderUrl: null,
      checkoutUrl: null,
      idempotentReplay: true,
    })
  }

  await auditLog({
    restaurantId: restaurant.id,
    eventType: 'qr.order_submitted',
    eventData: {
      orderId: orderResult.orderId,
      orderRef: orderResult.orderRef,
      payMode: input.payMode,
      tableId: table.id,
      totalCents: orderResult.totalCents,
      lineCount: input.lines.length,
      ip_masked: redactIp(ip),
    },
    actorType: 'guest',
    orderId: orderResult.orderId,
    ipAddress: ip,
  }).catch(() => {})

  // ── Pay-at-table: done. ──────────────────────────────────────────────────
  if (input.payMode === 'pay_at_table') {
    await auditLog({
      restaurantId: restaurant.id,
      eventType: 'tab.joined',
      eventData: {
        tabId: orderResult.tabId,
        orderId: orderResult.orderId,
      },
      actorType: 'guest',
      orderId: orderResult.orderId,
    }).catch(() => {})
    return NextResponse.json({
      ok: true,
      orderId: orderResult.orderId,
      orderRef: orderResult.orderRef,
      payMode: 'pay_at_table',
      viewOrderUrl,
      checkoutUrl: null,
      idempotentReplay: false,
    })
  }

  // ── Pay-now: create payment_intents + call Mollie. ──────────────────────
  const { data: intent, error: intentErr } = await admin
    .from('payment_intents')
    .insert({
      restaurant_id: restaurant.id,
      purpose: 'qr_order' as const,
      amount_cents: orderResult.totalCents,
      currency: orderResult.currency,
      status: 'pending' as const,
      idempotency_key: `order:${orderResult.orderId}`,
      metadata: {
        orderId: orderResult.orderId,
        orderRef: orderResult.orderRef,
        tableId: table.id,
      },
    })
    .select('id')
    .single()

  if (intentErr || !intent) {
    console.error('[order] payment_intent insert failed', intentErr?.message)
    return NextResponse.json({ ok: false, error: 'persistence_failed' }, { status: 500 })
  }

  // Link order → intent.
  await admin.from('orders').update({ payment_intent_id: intent.id }).eq('id', orderResult.orderId)

  const publicBaseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://thetafel.nl'
  const redirectBaseUrl = process.env.NODE_ENV === 'production' ? publicBaseUrl : 'http://localhost:3000'
  const redirectUrl = `${redirectBaseUrl}${localePrefix}/r/${input.slug}/qr/order/${orderResult.magicLinkPlaintext}`
  const webhookUrl = `${publicBaseUrl}/api/webhooks/mollie/consumer`
  const description =
    input.locale === 'nl'
      ? `Bestelling ${orderResult.orderRef} — ${displayName}`
      : `Order ${orderResult.orderRef} — ${displayName}`

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
    await admin
      .from('orders')
      .update({ status: 'cancelled', payment_status: 'failed' })
      .eq('id', orderResult.orderId)
    await auditLog({
      restaurantId: restaurant.id,
      eventType: 'qr.order_payment_failed',
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

  // Persist Mollie ids + checkout URL onto the intent.
  await admin
    .from('payment_intents')
    .update({
      provider_payment_id: paymentResult.molliePaymentId,
      metadata: {
        orderId: orderResult.orderId,
        orderRef: orderResult.orderRef,
        tableId: table.id,
        checkoutUrl: paymentResult.checkoutUrl,
      },
    })
    .eq('id', intent.id)

  await auditLog({
    restaurantId: restaurant.id,
    eventType: 'qr.order_payment_initiated',
    eventData: {
      orderId: orderResult.orderId,
      orderRef: orderResult.orderRef,
      intentId: intent.id,
      molliePaymentId: paymentResult.molliePaymentId,
      amountCents: orderResult.totalCents,
      method: input.paymentMethod ?? null,
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
    payMode: 'pay_now',
    checkoutUrl: paymentResult.checkoutUrl,
    viewOrderUrl,
    idempotentReplay: false,
  })
}
