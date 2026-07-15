// app/api/webhooks/mollie/consumer/route.ts
//
// Webhook target for consumer-facing connected-account payments
// (payment_intents.purpose = 'qr_order' and 'takeaway_order' today;
// 'deposit' shares the same payment_intents table and will plug into this
// same handler in a later unit — see the TODO below).
//
// IMPORTANT — this is NOT the same shape as /api/mollie/webhook (which
// handles platform-billed subscription payments via Mollie's newer
// signed JSON event-subscription mechanism). A payment created with
// `client.payments.create({ webhookUrl })` — which is how
// createConnectedPayment works — is called back by Mollie in the OLD,
// unsigned, form-urlencoded style: a POST with body `id=tr_xxx`, nothing
// else. There is no signature to verify here; the only trustworthy thing
// in the request is the payment id, which we use to re-fetch the payment's
// real status directly from Mollie using the restaurant's own OAuth token
// (never trust the mere fact that a webhook fired as proof of payment).
//
// Idempotent: safe to call twice for the same payment id. Always acks 200
// once the local lookup fails to find one of our payment_intents, so Mollie
// doesn't retry forever on something that isn't ours.

import { NextResponse, type NextRequest } from 'next/server'
import type { Payment } from '@mollie/api-client'
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'
import { getMollieOAuthClient } from '@/lib/mollie/client'
import { getValidAccessTokenForRestaurant } from '@/lib/mollie/webhook'
import { canTransitionOrderStatus, type OrderStatus } from '@/lib/orders/transitionOrderStatus'
import { auditLog } from '@/lib/consumer/audit'
import { sendTakeawayOrderConfirmedEmail } from '@/lib/consumer/notifications/dispatchTakeawayConfirmation'

export const runtime = 'nodejs'

type AdminClient = Awaited<ReturnType<typeof createSupabaseServerClientAdmin>>

const TERMINAL_UNSUCCESSFUL_STATUSES = new Set(['failed', 'expired', 'canceled'])

export async function POST(req: NextRequest) {
  let rawBody: string
  try {
    rawBody = await req.text()
  } catch {
    return NextResponse.json({ error: 'cannot_read_body' }, { status: 400 })
  }

  const params = new URLSearchParams(rawBody)
  const molliePaymentId = params.get('id')
  if (!molliePaymentId) {
    return NextResponse.json({ error: 'missing_id' }, { status: 400 })
  }

  const admin = await createSupabaseServerClientAdmin()

  const { data: intent, error: intentErr } = await admin
    .from('payment_intents')
    .select('id, restaurant_id, purpose, status, metadata')
    .eq('provider_payment_id', molliePaymentId)
    .maybeSingle()

  if (intentErr || !intent) {
    // Not one of ours (or not yet persisted, e.g. webhook raced the intent
    // update) — ack so Mollie doesn't retry forever.
    return NextResponse.json({ ok: true, unknown_payment: true })
  }

  // TODO(C6.3+): 'deposit' will route through here too once it adopts the
  // same webhookUrl. qr_order (C5.5) and takeaway_order (C6.3) are wired;
  // anything else is acknowledged as a no-op.
  if (intent.purpose !== 'qr_order' && intent.purpose !== 'takeaway_order') {
    return NextResponse.json({ ok: true, ignored: true, purpose: intent.purpose })
  }

  let molliePayment: Payment
  try {
    const accessToken = await getValidAccessTokenForRestaurant(admin, intent.restaurant_id)
    const client = getMollieOAuthClient(accessToken)
    molliePayment = await client.payments.get(molliePaymentId)
  } catch (err) {
    console.error('[webhooks/mollie/consumer] mollie fetch failed', err)
    return NextResponse.json({ error: 'mollie_fetch_failed' }, { status: 500 })
  }

  const meta = (intent.metadata ?? {}) as Record<string, unknown>
  const orderId = typeof meta.orderId === 'string' ? meta.orderId : null
  if (!orderId) {
    console.error('[webhooks/mollie/consumer] intent has no orderId in metadata', intent.id)
    return NextResponse.json({ ok: true, no_order_id: true })
  }

  const { data: order } = await admin
    .from('orders')
    .select('id, status, payment_status')
    .eq('id', orderId)
    .maybeSingle()

  if (!order) {
    return NextResponse.json({ ok: true, order_not_found: true })
  }

  if (molliePayment.status === 'paid') {
    await handlePaid(
      admin,
      intent.id,
      intent.restaurant_id,
      intent.purpose as 'qr_order' | 'takeaway_order',
      order as { id: string; status: OrderStatus; payment_status: string },
      molliePaymentId,
      molliePayment.redirectUrl ?? null,
    )
    return NextResponse.json({ ok: true })
  }

  if (TERMINAL_UNSUCCESSFUL_STATUSES.has(molliePayment.status)) {
    await handleFailed(
      admin,
      intent.id,
      intent.restaurant_id,
      intent.purpose as 'qr_order' | 'takeaway_order',
      order as { id: string; status: OrderStatus },
      molliePaymentId,
      molliePayment.status,
    )
  }

  return NextResponse.json({ ok: true })
}

async function handlePaid(
  admin: AdminClient,
  intentId: string,
  restaurantId: string,
  purpose: 'qr_order' | 'takeaway_order',
  order: { id: string; status: OrderStatus; payment_status: string },
  molliePaymentId: string,
  redirectUrl: string | null,
): Promise<void> {
  // Idempotent guard: already processed.
  if (order.payment_status === 'paid') {
    return
  }

  await admin
    .from('payment_intents')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', intentId)

  if (canTransitionOrderStatus(order.status, 'confirmed')) {
    await admin
      .from('orders')
      .update({ status: 'confirmed', payment_status: 'paid' })
      .eq('id', order.id)
      .eq('status', 'pending')
  }

  const eventPrefix = purpose === 'takeaway_order' ? 'takeaway' : 'qr'

  await auditLog({
    restaurantId,
    eventType: `${eventPrefix}.order_paid`,
    eventData: { orderId: order.id, molliePaymentId },
    actorType: 'system',
    orderId: order.id,
    paymentIntentId: intentId,
  }).catch(() => {})

  await auditLog({
    restaurantId,
    eventType: `${eventPrefix}.order_status_changed`,
    eventData: { orderId: order.id, from: order.status, to: 'confirmed' },
    actorType: 'system',
    orderId: order.id,
    paymentIntentId: intentId,
  }).catch(() => {})

  if (purpose === 'takeaway_order') {
    // redirectUrl is the URL we originally handed Mollie at payment
    // creation — it's the only surviving copy of the view-order magic-link
    // URL (the plaintext token is never persisted to the DB, only its
    // hash). Skip the email if it's somehow missing rather than guessing.
    if (redirectUrl) {
      await sendTakeawayOrderConfirmedEmail(order.id, redirectUrl).catch((err) => {
        console.error('[webhooks/mollie/consumer] confirmation email failed', err)
      })
    } else {
      console.error('[webhooks/mollie/consumer] no redirectUrl on paid takeaway payment', {
        orderId: order.id,
      })
    }
  }
  // QR order-paid notifications (email/WhatsApp) are deliberately not wired
  // in C5.5 — deferred to C7 / the notification-brief hardening pass.
}

async function handleFailed(
  admin: AdminClient,
  intentId: string,
  restaurantId: string,
  purpose: 'qr_order' | 'takeaway_order',
  order: { id: string; status: OrderStatus },
  molliePaymentId: string,
  mollieStatus: string,
): Promise<void> {
  await admin
    .from('payment_intents')
    .update({ status: 'failed', failed_at: new Date().toISOString() })
    .eq('id', intentId)

  // Note: orders.payment_status has no 'failed' value in its CHECK
  // constraint (orders_payment_status_check) — status='cancelled' alone
  // marks the order dead; payment_status is left as-is.
  await admin
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('id', order.id)
    .eq('status', 'pending')

  const eventPrefix = purpose === 'takeaway_order' ? 'takeaway' : 'qr'

  await auditLog({
    restaurantId,
    eventType: `${eventPrefix}.order_payment_failed`,
    eventData: { orderId: order.id, molliePaymentId, mollieStatus },
    actorType: 'system',
    orderId: order.id,
    paymentIntentId: intentId,
  }).catch(() => {})
}
