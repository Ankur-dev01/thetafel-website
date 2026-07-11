// app/api/webhooks/mollie/consumer/route.ts
//
// Webhook target for consumer-facing connected-account payments
// (payment_intents.purpose = 'qr_order' today; 'deposit' / 'takeaway_order'
// share the same payment_intents table and will plug into this same handler
// in a later unit — see the TODO below).
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

  // TODO(C5.5+): 'deposit' and 'takeaway_order' purposes will route through
  // here too once their submit flows adopt the same webhookUrl. For now only
  // qr_order is wired; anything else is acknowledged as a no-op.
  if (intent.purpose !== 'qr_order') {
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
    await handlePaid(admin, intent.id, intent.restaurant_id, order as { id: string; status: OrderStatus; payment_status: string }, molliePaymentId)
    return NextResponse.json({ ok: true })
  }

  if (TERMINAL_UNSUCCESSFUL_STATUSES.has(molliePayment.status)) {
    await handleFailed(admin, intent.id, intent.restaurant_id, order as { id: string; status: OrderStatus }, molliePaymentId, molliePayment.status)
  }

  return NextResponse.json({ ok: true })
}

async function handlePaid(
  admin: AdminClient,
  intentId: string,
  restaurantId: string,
  order: { id: string; status: OrderStatus; payment_status: string },
  molliePaymentId: string,
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

  await auditLog({
    restaurantId,
    eventType: 'qr.order_paid',
    eventData: { orderId: order.id, molliePaymentId },
    actorType: 'system',
    orderId: order.id,
    paymentIntentId: intentId,
  }).catch(() => {})

  await auditLog({
    restaurantId,
    eventType: 'qr.order_status_changed',
    eventData: { orderId: order.id, from: order.status, to: 'confirmed' },
    actorType: 'system',
    orderId: order.id,
    paymentIntentId: intentId,
  }).catch(() => {})

  // Notifications (email/WhatsApp on order-paid) are deliberately not wired
  // in C5.5 — the C3 dispatcher scaffolding exists but sending on this event
  // is deferred to C7 / the notification-brief hardening pass.
}

async function handleFailed(
  admin: AdminClient,
  intentId: string,
  restaurantId: string,
  order: { id: string; status: OrderStatus },
  molliePaymentId: string,
  mollieStatus: string,
): Promise<void> {
  await admin
    .from('payment_intents')
    .update({ status: 'failed', failed_at: new Date().toISOString() })
    .eq('id', intentId)

  await admin
    .from('orders')
    .update({ status: 'cancelled', payment_status: 'failed' })
    .eq('id', order.id)
    .eq('status', 'pending')

  await auditLog({
    restaurantId,
    eventType: 'qr.order_payment_failed',
    eventData: { orderId: order.id, molliePaymentId, mollieStatus },
    actorType: 'system',
    orderId: order.id,
    paymentIntentId: intentId,
  }).catch(() => {})
}
