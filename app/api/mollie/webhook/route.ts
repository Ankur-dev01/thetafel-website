import { NextResponse, type NextRequest } from 'next/server'
import { PaymentStatus } from '@mollie/api-client'
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'
import { getMolliePlatformClient } from '@/lib/mollie/client'
import {
  verifyMollieSignature,
  getMollieSignatureHeaderName,
  mapOnboardingStatus,
  fetchOnboardingStatus,
  getValidAccessTokenForRestaurant,
  fetchLatestValidMandate,
  refundPayment,
  createRecurringSubscription,
  type MollieStatus,
} from '@/lib/mollie/webhook'
import {
  buildRecurringDescription,
  formatMollieAmount,
  type SubscriptionTier,
} from '@/lib/pricing/subscription'

// Force Node.js runtime — crypto.createHmac and Buffer aren't available on Edge.
export const runtime = 'nodejs'

interface MollieEventPayload {
  id?: string
  type?: string
  createdAt?: string
  _embedded?: {
    organization?: { id?: string }
    payment?: { id?: string }
    subscription?: { id?: string }
    mandate?: { id?: string }
  }
}

function extractOrganizationId(payload: MollieEventPayload): string | null {
  return payload?._embedded?.organization?.id ?? null
}

export async function POST(req: NextRequest) {
  // 1. Read raw body once — signature is HMAC over raw bytes.
  let rawBody: string
  try {
    rawBody = await req.text()
  } catch {
    return NextResponse.json({ error: 'cannot_read_body' }, { status: 400 })
  }

  // 2. Signature verification (or dev bypass).
  const devBypass = process.env.MOLLIE_DEV_BYPASS_WEBHOOK_SIGNATURE === 'true'
  if (devBypass) {
    if (process.env.NODE_ENV === 'production') {
      // Hard refuse in production even if the flag is set — defence in depth.
      return NextResponse.json({ error: 'dev_bypass_not_allowed_in_production' }, { status: 403 })
    }
    // eslint-disable-next-line no-console
    console.warn('[mollie/webhook] signature verification skipped (dev bypass)')
  } else {
    const secret = process.env.MOLLIE_WEBHOOK_SIGNING_SECRET
    if (!secret) {
      return NextResponse.json({ error: 'signing_secret_not_configured' }, { status: 500 })
    }
    const sigHeader = req.headers.get(getMollieSignatureHeaderName())
    const ok = verifyMollieSignature(rawBody, sigHeader, secret)
    if (!ok) {
      return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
    }
  }

  // 3. Parse body now that signature is verified.
  let payload: MollieEventPayload
  try {
    payload = JSON.parse(rawBody) as MollieEventPayload
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const eventId = payload?.id
  const eventType = payload?.type
  if (!eventId || !eventType) {
    return NextResponse.json({ error: 'missing_event_fields' }, { status: 400 })
  }

  // 4. Idempotency + persistence — admin client (webhook has no session).
  const admin = await createSupabaseServerClientAdmin()

  // 4a. Already processed — ack and exit.
  const { data: existing } = await admin
    .from('mollie_webhook_events')
    .select('id, processed_at')
    .eq('mollie_event_id', eventId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ ok: true, duplicate: true }, { status: 200 })
  }

  // 4b. Insert the raw event before doing any work so a crash mid-processing
  //     still leaves an audit trail. The unique constraint protects against
  //     concurrent duplicate delivery.
  const { data: inserted, error: insertErr } = await admin
    .from('mollie_webhook_events')
    .insert({
      mollie_event_id: eventId,
      event_type: eventType,
      payload: payload as unknown as Record<string, unknown>,
    })
    .select('id')
    .single()

  if (insertErr || !inserted) {
    // Unique constraint tripped between our SELECT and INSERT — treat as duplicate.
    if (insertErr?.code === '23505') {
      return NextResponse.json({ ok: true, duplicate: true }, { status: 200 })
    }
    return NextResponse.json({ error: 'event_persist_failed' }, { status: 500 })
  }

  // 5. Process by event type.
  let processingError: string | null = null
  let restaurantId: string | null = null

  try {
    switch (eventType) {
      case 'organization.updated': {
        restaurantId = await handleOrganizationUpdated(admin, payload)
        break
      }
      case 'payment.paid': {
        restaurantId = await handlePaymentPaid(admin, eventId)
        break
      }
      case 'payment.failed': {
        restaurantId = await handlePaymentFailed(admin, eventId)
        break
      }
      // Accepted, persisted, acked — handlers land with future units.
      case 'subscription.charged':
      case 'subscription.cancelled':
      case 'mandate.revoked':
      default:
        break
    }
  } catch (err) {
    processingError = err instanceof Error ? err.message : 'unknown_processing_error'
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error(`[mollie/webhook] processing failed for ${eventType} ${eventId}:`, processingError)
    }
  }

  // 6. Mark the event row processed — always, even on error. Mollie retries
  //    on 5xx, so we capture the error and still record the attempt.
  await admin
    .from('mollie_webhook_events')
    .update({
      processed_at: new Date().toISOString(),
      processing_error: processingError,
    })
    .eq('id', inserted.id)

  // 7. Audit log — best-effort, never blocks the ack.
  try {
    await admin.from('audit_logs').insert({
      event_type: `mollie.${eventType}`,
      restaurant_id: restaurantId,
      event_data: {
        mollie_event_id: eventId,
        event_type: eventType,
        processing_error: processingError,
      },
    })
  } catch {
    // Audit failure must not break webhook ack.
  }

  // 8. 500 on processing error so Mollie retries; 200 otherwise.
  if (processingError) {
    return NextResponse.json({ ok: false, error: processingError }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}

// ── payment.paid ─────────────────────────────────────────────────────────────

async function handlePaymentPaid(
  admin: Awaited<ReturnType<typeof createSupabaseServerClientAdmin>>,
  paymentId: string
): Promise<string | null> {
  const mollie = getMolliePlatformClient()

  // 1. Fetch payment from Mollie to confirm status and read metadata.
  const molliePayment = await mollie.payments.get(paymentId)

  // 2. Only act when Mollie itself reports 'paid'.
  if (molliePayment.status !== PaymentStatus.paid) {
    void admin.from('audit_logs').insert({
      event_type: 'mollie.payment.paid.skipped_not_paid',
      event_data: { mollie_payment_id: paymentId, current_status: molliePayment.status },
    }).then(() => {}, () => {})
    return null
  }

  // 3. Look up our payment row.
  const { data: ourPayment } = await admin
    .from('payments')
    .select('id, restaurant_id, subscription_id, kind, status, amount_cents')
    .eq('mollie_payment_id', paymentId)
    .maybeSingle()

  if (!ourPayment) {
    void admin.from('audit_logs').insert({
      event_type: 'mollie.payment.paid.unknown_payment',
      event_data: { mollie_payment_id: paymentId },
    }).then(() => {}, () => {})
    return null
  }

  // 4. Business-logic idempotency.
  if (ourPayment.status === 'paid') {
    return ourPayment.restaurant_id as string
  }

  // 5. Mark our payment row paid.
  await admin.from('payments').update({
    status: 'paid',
    paid_at: new Date().toISOString(),
  }).eq('id', ourPayment.id)

  void admin.from('audit_logs').insert({
    restaurant_id: ourPayment.restaurant_id,
    event_type: 'subscription.payment_marked_paid',
    event_data: {
      mollie_payment_id: paymentId,
      our_payment_id: ourPayment.id,
      amount_cents: ourPayment.amount_cents,
      kind: ourPayment.kind,
    },
  }).then(() => {}, () => {})

  // 6. If this was the €0,01 verification, refund it.
  const metadata = molliePayment.metadata as Record<string, unknown> | null
  const isVerification =
    metadata?.is_verification === true ||
    (ourPayment.amount_cents === 1 && ourPayment.kind === 'subscription_charge')

  if (isVerification) {
    try {
      const refundId = await refundPayment({
        paymentId,
        amountValue: '0.01',
        description: 'The Tafel — Machtigingsverificatie terugbetaling',
      })
      void admin.from('audit_logs').insert({
        restaurant_id: ourPayment.restaurant_id,
        event_type: 'subscription.verification_refunded',
        event_data: { mollie_payment_id: paymentId, refund_id: refundId },
      }).then(() => {}, () => {})
    } catch (refundErr) {
      console.error('[webhook] verification refund failed:', refundErr)
      void admin.from('audit_logs').insert({
        restaurant_id: ourPayment.restaurant_id,
        event_type: 'subscription.verification_refund_failed',
        event_data: { mollie_payment_id: paymentId, error: String(refundErr) },
      }).then(() => {}, () => {})
    }
  }

  // 7. Load the subscription row.
  const { data: subscription } = await admin
    .from('subscriptions')
    .select('id, restaurant_id, tier, monthly_amount_cents, mollie_customer_id, mollie_mandate_id, mollie_subscription_id, trial_ends_at')
    .eq('id', ourPayment.subscription_id as string)
    .maybeSingle()

  if (!subscription) {
    console.error('[webhook] payment.paid: no subscription row found for our payment', ourPayment.id)
    return ourPayment.restaurant_id as string
  }

  // 8. Idempotency: if both mandate and Mollie subscription are already set, advance step and exit.
  if (subscription.mollie_mandate_id && subscription.mollie_subscription_id) {
    await admin.from('restaurants')
      .update({ current_onboarding_step: 13 })
      .eq('id', subscription.restaurant_id as string)
      .lt('current_onboarding_step', 13)
    return subscription.restaurant_id as string
  }

  // 9. Fetch the mandate that was just registered.
  let mandateId = subscription.mollie_mandate_id as string | null
  if (!mandateId) {
    mandateId = await fetchLatestValidMandate(subscription.mollie_customer_id as string)
    if (!mandateId) {
      console.error('[webhook] payment paid but no valid mandate found for customer', subscription.mollie_customer_id)
      void admin.from('audit_logs').insert({
        restaurant_id: subscription.restaurant_id,
        event_type: 'subscription.mandate_not_found',
        event_data: {
          mollie_customer_id: subscription.mollie_customer_id,
          mollie_payment_id: paymentId,
        },
      }).then(() => {}, () => {})
      throw new Error('mandate_not_yet_available')
    }
    await admin.from('subscriptions')
      .update({ mollie_mandate_id: mandateId })
      .eq('id', subscription.id)
  }

  // 10. Create the Mollie recurring subscription.
  let mollieSubscriptionId = subscription.mollie_subscription_id as string | null
  if (!mollieSubscriptionId) {
    const startDateIsoDate = (subscription.trial_ends_at as string).slice(0, 10)
    const grossAmountValue = formatMollieAmount(subscription.monthly_amount_cents as number)
    const description = buildRecurringDescription({
      locale: 'nl',
      tier: subscription.tier as SubscriptionTier,
    })
    const webhookUrl = `${process.env.QR_BASE_URL || 'https://thetafel.nl'}/api/mollie/webhook`

    try {
      mollieSubscriptionId = await createRecurringSubscription({
        customerId: subscription.mollie_customer_id as string,
        mandateId,
        amountValue: grossAmountValue,
        description,
        startDateIsoDate,
        webhookUrl,
      })
      await admin.from('subscriptions')
        .update({ mollie_subscription_id: mollieSubscriptionId })
        .eq('id', subscription.id)
      void admin.from('audit_logs').insert({
        restaurant_id: subscription.restaurant_id,
        event_type: 'subscription.recurring_created',
        event_data: {
          mollie_subscription_id: mollieSubscriptionId,
          mollie_mandate_id: mandateId,
          start_date: startDateIsoDate,
          gross_monthly_cents: subscription.monthly_amount_cents,
        },
      }).then(() => {}, () => {})
    } catch (createErr) {
      console.error('[webhook] failed to create Mollie subscription:', createErr)
      void admin.from('audit_logs').insert({
        restaurant_id: subscription.restaurant_id,
        event_type: 'subscription.recurring_create_failed',
        event_data: { error: String(createErr), mollie_mandate_id: mandateId },
      }).then(() => {}, () => {})
      throw new Error(`subscription_create_failed: ${String(createErr)}`)
    }
  }

  // 11. Advance the restaurant's onboarding step.
  await admin.from('restaurants')
    .update({ current_onboarding_step: 13 })
    .eq('id', subscription.restaurant_id as string)
    .lt('current_onboarding_step', 13)

  void admin.from('audit_logs').insert({
    restaurant_id: subscription.restaurant_id,
    event_type: 'subscription.onboarding_advanced_to_13',
    event_data: { mollie_subscription_id: mollieSubscriptionId },
  }).then(() => {}, () => {})

  return subscription.restaurant_id as string
}

// ── payment.failed ────────────────────────────────────────────────────────────

async function handlePaymentFailed(
  admin: Awaited<ReturnType<typeof createSupabaseServerClientAdmin>>,
  paymentId: string
): Promise<string | null> {
  const mollie = getMolliePlatformClient()
  const molliePayment = await mollie.payments.get(paymentId)

  const { data: ourPayment } = await admin
    .from('payments')
    .select('id, restaurant_id, status')
    .eq('mollie_payment_id', paymentId)
    .maybeSingle()

  if (!ourPayment) {
    return null
  }

  if (ourPayment.status === 'failed') {
    return ourPayment.restaurant_id as string
  }

  await admin.from('payments').update({
    status: 'failed',
    failed_at: new Date().toISOString(),
    failure_reason: `mollie_status_${molliePayment.status}`,
  }).eq('id', ourPayment.id)

  void admin.from('audit_logs').insert({
    restaurant_id: ourPayment.restaurant_id,
    event_type: 'subscription.payment_failed',
    event_data: {
      mollie_payment_id: paymentId,
      mollie_status: molliePayment.status,
      our_payment_id: ourPayment.id,
    },
  }).then(() => {}, () => {})

  return ourPayment.restaurant_id as string
}

// ── organization.updated ──────────────────────────────────────────────────────

async function handleOrganizationUpdated(
  admin: Awaited<ReturnType<typeof createSupabaseServerClientAdmin>>,
  payload: MollieEventPayload
): Promise<string | null> {
  const orgId = extractOrganizationId(payload)
  if (!orgId) {
    throw new Error('organization_id_missing_from_payload')
  }

  const { data: restaurant, error } = await admin
    .from('restaurants')
    .select('id')
    .eq('mollie_organization_id', orgId)
    .maybeSingle()

  if (error || !restaurant) {
    // Unknown org — stale webhook from a removed connection. No-op.
    return null
  }

  const accessToken = await getValidAccessTokenForRestaurant(admin, restaurant.id)
  const onboardingStatus = await fetchOnboardingStatus(accessToken)
  const next: MollieStatus = mapOnboardingStatus(onboardingStatus)

  const updatePayload: Record<string, unknown> = { mollie_status: next }
  if (next === 'verified') {
    updatePayload.mollie_verified_at = new Date().toISOString()
  }

  const { error: updateErr } = await admin
    .from('restaurants')
    .update(updatePayload)
    .eq('id', restaurant.id)

  if (updateErr) {
    throw new Error(`restaurant_update_failed:${updateErr.message}`)
  }

  return restaurant.id
}
