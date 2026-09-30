import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Payment } from '@mollie/api-client'
import { getMolliePlatformClient } from '@/lib/mollie/client'
import { resolveRestaurantRecipient } from '@/lib/notifications/restaurant/resolveRecipient'
import {
  onRecurringFailed,
  onRecurringPaid,
  onSubscriptionCancelledAtMollie,
  type RestaurantFacts,
  type RestaurantPatch,
  type SubscriptionFacts,
  type SubscriptionPatch,
  type Transition,
} from './lifecycle'

/**
 * Platform-subscription webhook handling (D6.5): recurring charges, and the
 * subscription.cancelled / mandate.revoked events. Thin glue around the pure
 * state machine in ./lifecycle — this file only reads facts, upserts the
 * payment row, and writes the patches the state machine returns.
 *
 * Every entry point is idempotent: Mollie retries webhooks, and the legacy
 * form-encoded path has no event store, so each function compares against
 * what is already stored before changing anything.
 */

type Admin = SupabaseClient

type SubscriptionRow = SubscriptionFacts & {
  id: string
  restaurant_id: string
  tier: 'starter' | 'plus' | 'premium'
  vat_rate_bps: number
  mollie_customer_id: string | null
  mollie_subscription_id: string | null
}

const SUBSCRIPTION_SELECT =
  'id, restaurant_id, tier, status, vat_rate_bps, trial_ends_at, current_period_end, cancelled_at, mollie_customer_id, mollie_subscription_id'

// payment_status enum: pending | paid | failed | refunded | partially_refunded.
// Mollie's expired / canceled have no enum value — they are failed charges.
type OurPaymentStatus = 'pending' | 'paid' | 'failed'

export function mapRecurringStatus(mollieStatus: string): OurPaymentStatus {
  if (mollieStatus === 'paid') return 'paid'
  if (mollieStatus === 'failed' || mollieStatus === 'expired' || mollieStatus === 'canceled') return 'failed'
  return 'pending'
}

function toCents(value: string): number {
  return Math.round(Number.parseFloat(value) * 100)
}

async function audit(admin: Admin, restaurantId: string | null, eventType: string, data: Record<string, unknown>) {
  try {
    await admin.from('audit_logs').insert({ restaurant_id: restaurantId, event_type: eventType, event_data: data })
  } catch {
    // Audit failures never fail a webhook ack.
  }
}

function describeCharge(tier: string, isoDate: string, locale: 'nl' | 'en'): string {
  const month = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'nl-NL', {
    timeZone: 'Europe/Amsterdam',
    month: 'long',
    year: 'numeric',
  }).format(new Date(isoDate))
  const tierName = tier.charAt(0).toUpperCase() + tier.slice(1)
  return `The Tafel ${tierName} — ${month}`
}

/** Apply a state-machine transition: subscription + restaurant patches, then one audit row per event. */
async function applyTransition(
  admin: Admin,
  sub: SubscriptionRow,
  t: Transition,
  context: Record<string, unknown>,
): Promise<void> {
  const subPatch: SubscriptionPatch = t.subscription
  if (Object.keys(subPatch).length > 0) {
    const { error } = await admin.from('subscriptions').update(subPatch).eq('id', sub.id)
    if (error) throw new Error(`subscription_update_failed: ${error.message}`)
  }
  const rPatch: RestaurantPatch = t.restaurant
  if (Object.keys(rPatch).length > 0) {
    const { error } = await admin.from('restaurants').update(rPatch).eq('id', sub.restaurant_id)
    if (error) throw new Error(`restaurant_update_failed: ${error.message}`)
  }
  for (const event of t.events) {
    await audit(admin, sub.restaurant_id, event, { subscription_id: sub.id, ...context })
  }
}

async function loadRestaurantFacts(admin: Admin, restaurantId: string): Promise<RestaurantFacts> {
  const { data } = await admin
    .from('restaurants')
    .select('grace_period_started_at, paused_at, pause_reason')
    .eq('id', restaurantId)
    .maybeSingle<RestaurantFacts>()
  return data ?? { grace_period_started_at: null, paused_at: null, pause_reason: null }
}

async function findSubscriptionForPayment(admin: Admin, payment: Payment): Promise<SubscriptionRow | null> {
  if (payment.subscriptionId) {
    const { data } = await admin
      .from('subscriptions')
      .select(SUBSCRIPTION_SELECT)
      .eq('mollie_subscription_id', payment.subscriptionId)
      .maybeSingle<SubscriptionRow>()
    return data ?? null
  }
  // Recurring payment without a subscriptionId: only ours if the customer is.
  if (payment.sequenceType === 'recurring' && payment.customerId) {
    const { data } = await admin
      .from('subscriptions')
      .select(SUBSCRIPTION_SELECT)
      .eq('mollie_customer_id', payment.customerId)
      .in('status', ['trialing', 'active', 'past_due', 'suspended'])
      .maybeSingle<SubscriptionRow>()
    return data ?? null
  }
  return null
}

/** True when a fetched Mollie payment is a recurring (subscription) charge rather than a first payment. */
export function isRecurringPayment(payment: Payment): boolean {
  return Boolean(payment.subscriptionId) || payment.sequenceType === 'recurring'
}

async function assignInvoiceNumber(admin: Admin, paymentId: string): Promise<string | null> {
  const { data, error } = await admin.rpc('assign_invoice_number', { p_payment_id: paymentId })
  if (error) {
    console.error('[billing] assign_invoice_number failed', error.message)
    return null
  }
  return typeof data === 'string' ? data : null
}

async function fetchNextPaymentDate(sub: { mollie_customer_id: string | null; mollie_subscription_id: string | null }): Promise<string | null> {
  if (!sub.mollie_customer_id || !sub.mollie_subscription_id) return null
  try {
    const s = await getMolliePlatformClient().customerSubscriptions.get(sub.mollie_subscription_id, {
      customerId: sub.mollie_customer_id,
    })
    return s.nextPaymentDate ?? null
  } catch (err) {
    console.error('[billing] fetch subscription nextPaymentDate failed', err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * A fetched Mollie payment that belongs to a platform subscription.
 * Returns the restaurant id when it was ours, null when unknown (the caller
 * acks 200 either way — same "not ours" behaviour as before).
 */
export type RecurringDeps = {
  /** Defaults to the assign_invoice_number RPC. Injectable so tests never burn real invoice numbers. */
  assignInvoice?: (paymentId: string) => Promise<string | null>
  /** Defaults to a GET on the Mollie subscription. */
  fetchNextDate?: (sub: { mollie_customer_id: string | null; mollie_subscription_id: string | null }) => Promise<string | null>
}

export async function handleRecurringPayment(
  admin: Admin,
  payment: Payment,
  deps: RecurringDeps = {},
): Promise<string | null> {
  const assignInvoice = deps.assignInvoice ?? ((id: string) => assignInvoiceNumber(admin, id))
  const fetchNext = deps.fetchNextDate ?? fetchNextPaymentDate
  const sub = await findSubscriptionForPayment(admin, payment)
  if (!sub) {
    console.warn('[billing] recurring payment for unknown subscription', payment.id)
    return null
  }

  const newStatus = mapRecurringStatus(payment.status)

  const { data: existing } = await admin
    .from('payments')
    .select('id, status, invoice_number')
    .eq('mollie_payment_id', payment.id)
    .maybeSingle<{ id: string; status: string; invoice_number: string | null }>()

  // Retry / no-op guards. A paid row never regresses.
  if (existing && (existing.status === newStatus || existing.status === 'paid')) {
    if (existing.status === 'paid' && !existing.invoice_number) await assignInvoice(existing.id)
    return sub.restaurant_id
  }

  const now = new Date().toISOString()
  const paidAt = payment.paidAt ?? now
  const recipient = await resolveRestaurantRecipient(sub.restaurant_id)
  const locale = recipient?.locale ?? 'nl'

  const row = {
    restaurant_id: sub.restaurant_id,
    subscription_id: sub.id,
    mollie_subscription_id: payment.subscriptionId ?? sub.mollie_subscription_id,
    mollie_payment_id: payment.id,
    kind: 'subscription_charge',
    status: newStatus,
    amount_cents: toCents(payment.amount.value),
    currency: payment.amount.currency,
    vat_rate_bps: sub.vat_rate_bps,
    description: describeCharge(sub.tier, payment.createdAt ?? now, locale),
    ...(newStatus === 'paid' ? { paid_at: paidAt } : {}),
    ...(newStatus === 'failed'
      ? { failed_at: now, failure_reason: `mollie_status_${payment.status}` }
      : {}),
  }

  const { data: saved, error: upsertError } = await admin
    .from('payments')
    .upsert(row, { onConflict: 'mollie_payment_id' })
    .select('id')
    .single<{ id: string }>()
  if (upsertError || !saved) throw new Error(`payment_upsert_failed: ${upsertError?.message ?? 'no row'}`)

  const facts = await loadRestaurantFacts(admin, sub.restaurant_id)
  const context = { mollie_payment_id: payment.id, payment_id: saved.id, mollie_status: payment.status }

  if (newStatus === 'paid') {
    await assignInvoice(saved.id)
    const next = await fetchNext(sub)
    await applyTransition(
      admin,
      sub,
      onRecurringPaid({ sub, restaurant: facts, paidAt, nextPaymentDate: next }),
      context,
    )
  } else if (newStatus === 'failed') {
    await applyTransition(admin, sub, onRecurringFailed({ sub, restaurant: facts, now }), context)
  }
  // pending (e.g. SEPA still processing): row stored, no transition yet.

  return sub.restaurant_id
}

/** subscription.cancelled — remember it; the daily lifecycle job ends it at period end. */
export async function handleSubscriptionCancelledEvent(admin: Admin, mollieSubscriptionId: string): Promise<string | null> {
  const { data: sub } = await admin
    .from('subscriptions')
    .select(SUBSCRIPTION_SELECT)
    .eq('mollie_subscription_id', mollieSubscriptionId)
    .maybeSingle<SubscriptionRow>()
  if (!sub) return null

  const patch = onSubscriptionCancelledAtMollie({ sub, now: new Date().toISOString() })
  if (Object.keys(patch).length > 0) {
    const { error } = await admin.from('subscriptions').update(patch).eq('id', sub.id)
    if (error) throw new Error(`subscription_update_failed: ${error.message}`)
  }
  await audit(admin, sub.restaurant_id, 'subscription.cancelled_at_mollie', {
    subscription_id: sub.id,
    mollie_subscription_id: mollieSubscriptionId,
    set_cancelled_at: Object.keys(patch).length > 0,
  })
  return sub.restaurant_id
}

/** mandate.revoked — drop the mandate id; do NOT suspend (the next failed charge starts the grace period). */
export async function handleMandateRevokedEvent(admin: Admin, mollieMandateId: string): Promise<string | null> {
  const { data: sub } = await admin
    .from('subscriptions')
    .select('id, restaurant_id')
    .eq('mollie_mandate_id', mollieMandateId)
    .maybeSingle<{ id: string; restaurant_id: string }>()
  if (!sub) return null

  const { error } = await admin.from('subscriptions').update({ mollie_mandate_id: null }).eq('id', sub.id)
  if (error) throw new Error(`subscription_update_failed: ${error.message}`)
  await audit(admin, sub.restaurant_id, 'subscription.mandate_revoked', {
    subscription_id: sub.id,
    mollie_mandate_id: mollieMandateId,
  })
  return sub.restaurant_id
}
