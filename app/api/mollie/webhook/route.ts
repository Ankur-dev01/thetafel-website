import { NextResponse, type NextRequest } from 'next/server'
import { PaymentStatus, type Payment } from '@mollie/api-client'
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'
import {
  verifyMollieSignature,
  getMollieSignatureHeaderName,
  fetchLatestValidMandate,
  refundPayment,
  createRecurringSubscription,
} from '@/lib/mollie/webhook'
import {
  parseLegacyWebhookBody,
  classifyMollieId,
  fetchPaymentFromMollie,
} from '@/lib/mollie/legacy-webhook'
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

type AdminClient = Awaited<ReturnType<typeof createSupabaseServerClientAdmin>>

type DomainPaymentStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'canceled'

interface PaymentRow {
  id: string
  restaurant_id: string
  subscription_id: string | null
  kind: string
  status: string
  amount_cents: number
  mollie_payment_id: string
}

function mapMolliePaymentStatusToOurs(mollieStatus: string): DomainPaymentStatus {
  switch (mollieStatus) {
    case 'paid': return 'paid'
    case 'failed': return 'failed'
    case 'expired': return 'expired'
    case 'canceled': return 'canceled'
    default: return 'pending'
  }
}

// ── Shared processing helper ──────────────────────────────────────────────────

async function processPaymentStatusChange(
  admin: AdminClient,
  paymentRow: PaymentRow,
  molliePayment: Payment,
  newStatus: DomainPaymentStatus
): Promise<void> {
  if (newStatus === 'paid') {
    await admin.from('payments').update({
      status: 'paid',
      paid_at: new Date().toISOString(),
    }).eq('id', paymentRow.id)

    void admin.from('audit_logs').insert({
      restaurant_id: paymentRow.restaurant_id,
      event_type: 'subscription.payment_marked_paid',
      event_data: {
        mollie_payment_id: paymentRow.mollie_payment_id,
        our_payment_id: paymentRow.id,
        amount_cents: paymentRow.amount_cents,
        kind: paymentRow.kind,
      },
    }).then(() => {}, () => {})

    const metadata = molliePayment.metadata as Record<string, unknown> | null
    const isVerification =
      metadata?.is_verification === true ||
      (paymentRow.amount_cents === 1 && paymentRow.kind === 'subscription_charge')

    if (isVerification) {
      try {
        const refundId = await refundPayment({
          paymentId: paymentRow.mollie_payment_id,
          amountValue: '0.01',
          description: 'The Tafel — Machtigingsverificatie terugbetaling',
        })
        void admin.from('audit_logs').insert({
          restaurant_id: paymentRow.restaurant_id,
          event_type: 'subscription.verification_refunded',
          event_data: { mollie_payment_id: paymentRow.mollie_payment_id, refund_id: refundId },
        }).then(() => {}, () => {})
      } catch (refundErr) {
        console.error('[webhook] verification refund failed:', refundErr)
        void admin.from('audit_logs').insert({
          restaurant_id: paymentRow.restaurant_id,
          event_type: 'subscription.verification_refund_failed',
          event_data: { mollie_payment_id: paymentRow.mollie_payment_id, error: String(refundErr) },
        }).then(() => {}, () => {})
      }
    }

    const { data: subscription } = await admin
      .from('subscriptions')
      .select('id, restaurant_id, tier, monthly_amount_cents, mollie_customer_id, mollie_mandate_id, mollie_subscription_id, trial_ends_at')
      .eq('id', paymentRow.subscription_id as string)
      .maybeSingle()

    if (!subscription) {
      console.error('[webhook] payment paid: no subscription row for payment', paymentRow.id)
      return
    }

    if (subscription.mollie_mandate_id && subscription.mollie_subscription_id) {
      await admin.from('restaurants')
        .update({ current_onboarding_step: 13 })
        .eq('id', subscription.restaurant_id as string)
        .lt('current_onboarding_step', 13)
      return
    }

    let mandateId = subscription.mollie_mandate_id as string | null
    if (!mandateId) {
      mandateId = await fetchLatestValidMandate(subscription.mollie_customer_id as string)
      if (!mandateId) {
        console.error('[webhook] payment paid but no valid mandate for customer', subscription.mollie_customer_id)
        void admin.from('audit_logs').insert({
          restaurant_id: subscription.restaurant_id,
          event_type: 'subscription.mandate_not_found',
          event_data: {
            mollie_customer_id: subscription.mollie_customer_id,
            mollie_payment_id: paymentRow.mollie_payment_id,
          },
        }).then(() => {}, () => {})
        throw new Error('mandate_not_yet_available')
      }
      await admin.from('subscriptions')
        .update({ mollie_mandate_id: mandateId })
        .eq('id', subscription.id)
    }

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

    await admin.from('restaurants')
      .update({ current_onboarding_step: 13 })
      .eq('id', subscription.restaurant_id as string)
      .lt('current_onboarding_step', 13)

    void admin.from('audit_logs').insert({
      restaurant_id: subscription.restaurant_id,
      event_type: 'subscription.onboarding_advanced_to_13',
      event_data: { mollie_subscription_id: mollieSubscriptionId },
    }).then(() => {}, () => {})

  } else {
    await admin.from('payments').update({
      status: newStatus,
      failed_at: new Date().toISOString(),
      failure_reason: `mollie_status_${newStatus}`,
    }).eq('id', paymentRow.id)

    void admin.from('audit_logs').insert({
      restaurant_id: paymentRow.restaurant_id,
      event_type: 'subscription.payment_failed',
      event_data: {
        mollie_payment_id: paymentRow.mollie_payment_id,
        mollie_status: newStatus,
        our_payment_id: paymentRow.id,
      },
    }).then(() => {}, () => {})
  }
}

// ── Legacy webhook handler ────────────────────────────────────────────────────

async function handleLegacyWebhook(rawBody: string) {
  const mollieId = parseLegacyWebhookBody(rawBody)
  if (!mollieId) {
    return NextResponse.json({ error: 'invalid_legacy_body' }, { status: 400 })
  }

  const kind = classifyMollieId(mollieId)

  if (kind !== 'payment') {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn(`[mollie/webhook] legacy webhook for non-payment id: ${mollieId} (kind=${kind}) — acked, not processed`)
    }
    return NextResponse.json({ ok: true, ignored: true, kind }, { status: 200 })
  }

  let molliePayment: Awaited<ReturnType<typeof fetchPaymentFromMollie>>
  try {
    molliePayment = await fetchPaymentFromMollie(mollieId)
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('[mollie/webhook][legacy] fetch failed:', err instanceof Error ? err.message : err)
    }
    return NextResponse.json({ error: 'mollie_fetch_failed' }, { status: 500 })
  }

  if (!molliePayment) {
    return NextResponse.json({ ok: true, unknown_payment: true }, { status: 200 })
  }

  const admin = await createSupabaseServerClientAdmin()

  const { data: paymentRow } = await admin
    .from('payments')
    .select('id, restaurant_id, subscription_id, kind, status, amount_cents, mollie_payment_id')
    .eq('mollie_payment_id', mollieId)
    .maybeSingle()

  if (!paymentRow) {
    return NextResponse.json({ ok: true, no_local_row: true }, { status: 200 })
  }

  const newStatus = mapMolliePaymentStatusToOurs(molliePayment.status)
  if (newStatus === paymentRow.status) {
    return NextResponse.json({ ok: true, no_change: true }, { status: 200 })
  }

  let processingError: string | null = null
  try {
    await processPaymentStatusChange(admin, paymentRow as PaymentRow, molliePayment, newStatus)
  } catch (err) {
    processingError = err instanceof Error ? err.message : 'unknown_processing_error'
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error(`[mollie/webhook][legacy] processing failed for ${mollieId}:`, processingError)
    }
  }

  try {
    await admin.from('audit_logs').insert({
      event_type: 'mollie.legacy_payment_status_change',
      restaurant_id: paymentRow.restaurant_id as string,
      event_data: {
        mollie_payment_id: mollieId,
        from_status: paymentRow.status,
        to_status: newStatus,
        kind: paymentRow.kind,
        amount_cents: paymentRow.amount_cents,
        processing_error: processingError,
      },
    })
  } catch {
    // Audit failures don't fail the ack.
  }

  if (processingError) {
    return NextResponse.json({ ok: false, error: processingError }, { status: 500 })
  }

  return NextResponse.json({ ok: true, transitioned: { from: paymentRow.status, to: newStatus } }, { status: 200 })
}

// ── Next-gen webhook handler ──────────────────────────────────────────────────

async function handleNextGenWebhook(req: NextRequest, rawBody: string) {
  // Signature verification (or dev bypass).
  const devBypass = process.env.MOLLIE_DEV_BYPASS_WEBHOOK_SIGNATURE === 'true'
  if (devBypass) {
    if (process.env.NODE_ENV === 'production') {
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

  const admin = await createSupabaseServerClientAdmin()

  const { data: existing } = await admin
    .from('mollie_webhook_events')
    .select('id, processed_at')
    .eq('mollie_event_id', eventId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ ok: true, duplicate: true }, { status: 200 })
  }

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
    if (insertErr?.code === '23505') {
      return NextResponse.json({ ok: true, duplicate: true }, { status: 200 })
    }
    return NextResponse.json({ error: 'event_persist_failed' }, { status: 500 })
  }

  let processingError: string | null = null
  let restaurantId: string | null = null

  try {
    switch (eventType) {
      case 'payment.paid': {
        restaurantId = await handleNextGenPaymentPaid(admin, eventId)
        break
      }
      case 'payment.failed': {
        restaurantId = await handleNextGenPaymentFailed(admin, eventId)
        break
      }
      // organization.updated: no-op — Mollie is deprecating this event.
      // Event is persisted above; KYC status is now polled via /api/v1/restaurants/mollie/kyc-status.
      case 'organization.updated':
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

  await admin
    .from('mollie_webhook_events')
    .update({
      processed_at: new Date().toISOString(),
      processing_error: processingError,
    })
    .eq('id', inserted.id)

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

  if (processingError) {
    return NextResponse.json({ ok: false, error: processingError }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}

async function handleNextGenPaymentPaid(
  admin: AdminClient,
  paymentId: string
): Promise<string | null> {
  const molliePayment = await fetchPaymentFromMollie(paymentId)

  if (!molliePayment) {
    void admin.from('audit_logs').insert({
      event_type: 'mollie.payment.paid.mollie_not_found',
      event_data: { mollie_payment_id: paymentId },
    }).then(() => {}, () => {})
    return null
  }

  if (molliePayment.status !== PaymentStatus.paid) {
    void admin.from('audit_logs').insert({
      event_type: 'mollie.payment.paid.skipped_not_paid',
      event_data: { mollie_payment_id: paymentId, current_status: molliePayment.status },
    }).then(() => {}, () => {})
    return null
  }

  const { data: paymentRow } = await admin
    .from('payments')
    .select('id, restaurant_id, subscription_id, kind, status, amount_cents, mollie_payment_id')
    .eq('mollie_payment_id', paymentId)
    .maybeSingle()

  if (!paymentRow) {
    void admin.from('audit_logs').insert({
      event_type: 'mollie.payment.paid.unknown_payment',
      event_data: { mollie_payment_id: paymentId },
    }).then(() => {}, () => {})
    return null
  }

  if (paymentRow.status === 'paid') {
    return paymentRow.restaurant_id as string
  }

  await processPaymentStatusChange(admin, paymentRow as PaymentRow, molliePayment, 'paid')
  return paymentRow.restaurant_id as string
}

async function handleNextGenPaymentFailed(
  admin: AdminClient,
  paymentId: string
): Promise<string | null> {
  const molliePayment = await fetchPaymentFromMollie(paymentId)

  if (!molliePayment) {
    return null
  }

  const { data: paymentRow } = await admin
    .from('payments')
    .select('id, restaurant_id, subscription_id, kind, status, amount_cents, mollie_payment_id')
    .eq('mollie_payment_id', paymentId)
    .maybeSingle()

  if (!paymentRow) {
    return null
  }

  const newStatus = mapMolliePaymentStatusToOurs(molliePayment.status)
  if (paymentRow.status === newStatus || paymentRow.status === 'failed') {
    return paymentRow.restaurant_id as string
  }

  await processPaymentStatusChange(admin, paymentRow as PaymentRow, molliePayment, newStatus === 'pending' ? 'failed' : newStatus)
  return paymentRow.restaurant_id as string
}

// ── Entry point ───────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let rawBody: string
  try {
    rawBody = await req.text()
  } catch {
    return NextResponse.json({ error: 'cannot_read_body' }, { status: 400 })
  }

  const contentType = (req.headers.get('content-type') ?? '').toLowerCase()
  const isLegacy = contentType.includes('application/x-www-form-urlencoded')
  const isNextGen = contentType.includes('application/json')

  if (isLegacy) {
    return handleLegacyWebhook(rawBody)
  }
  if (isNextGen) {
    return handleNextGenWebhook(req, rawBody)
  }
  return NextResponse.json({ error: 'unknown_webhook_format' }, { status: 400 })
}
