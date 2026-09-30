import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { getMolliePlatformClient } from '@/lib/mollie/client'

/**
 * Billing data for /dashboard/settings/billing. Everything here is scoped by
 * restaurant_id and runs with the service-role client AFTER the caller has
 * passed the owner gate. Mollie calls use the PLATFORM client (The Tafel's own
 * customer / mandate / subscription), never a restaurant's OAuth client.
 */

export type SubscriptionRow = {
  id: string
  tier: 'starter' | 'plus' | 'premium'
  status: string
  monthly_amount_cents: number
  vat_rate_bps: number
  mollie_customer_id: string | null
  mollie_mandate_id: string | null
  mollie_subscription_id: string | null
  trial_ends_at: string | null
  current_period_end: string | null
  cancelled_at: string | null
}

export const SUBSCRIPTION_COLUMNS =
  'id, tier, status, monthly_amount_cents, vat_rate_bps, mollie_customer_id, mollie_mandate_id, mollie_subscription_id, trial_ends_at, current_period_end, cancelled_at'

export type PaymentRow = {
  id: string
  kind: string
  status: string
  amount_cents: number
  currency: string
  description: string | null
  vat_rate_bps: number | null
  paid_at: string | null
  created_at: string
  invoice_number: string | null
  mollie_payment_id: string | null
}

export const PAYMENT_COLUMNS =
  'id, kind, status, amount_cents, currency, description, vat_rate_bps, paid_at, created_at, invoice_number, mollie_payment_id'

/** Split a VAT-inclusive amount into net + VAT at the snapshotted rate. */
export function splitGross(grossCents: number, vatRateBps: number): { net: number; vat: number; gross: number } {
  const net = Math.round((grossCents * 10000) / (10000 + vatRateBps))
  return { net, vat: grossCents - net, gross: grossCents }
}

/** Whole days from now until `iso`, rounded up; null if not in the future. */
export function daysUntil(iso: string | null, now: Date): number | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - now.getTime()
  if (!Number.isFinite(ms) || ms <= 0) return null
  return Math.ceil(ms / 86_400_000)
}

/** The €0,01 mandate-verification charge is refunded at once — not billable. */
export function isVerificationCharge(p: Pick<PaymentRow, 'kind' | 'amount_cents'>): boolean {
  return p.kind === 'subscription_charge' && p.amount_cents <= 1
}

// ── Payment method (mandate) ────────────────────────────────────────────────

export type PaymentMethodInfo =
  | { state: 'none' }
  | { state: 'unavailable' }
  | { state: 'ok'; method: 'directdebit' | 'creditcard' | 'paypal' | 'other'; brand: string | null; last4: string | null }

const MANDATE_TIMEOUT_MS = 5000

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('mollie_timeout')), ms)
    promise.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e)
      },
    )
  })
}

export async function fetchPaymentMethod(sub: SubscriptionRow): Promise<PaymentMethodInfo> {
  if (!sub.mollie_customer_id || !sub.mollie_mandate_id) return { state: 'none' }
  try {
    const mandate = await withTimeout(
      getMolliePlatformClient().customerMandates.get(sub.mollie_mandate_id, {
        customerId: sub.mollie_customer_id,
      }),
      MANDATE_TIMEOUT_MS,
    )
    const details = (mandate.details ?? {}) as unknown as Record<string, unknown>
    const method = String(mandate.method)
    if (method === 'directdebit') {
      const iban = typeof details.consumerAccount === 'string' ? details.consumerAccount : ''
      return { state: 'ok', method: 'directdebit', brand: null, last4: iban ? iban.slice(-4) : null }
    }
    if (method === 'creditcard') {
      const number = typeof details.cardNumber === 'string' ? details.cardNumber : ''
      const label = typeof details.cardLabel === 'string' ? details.cardLabel : null
      return { state: 'ok', method: 'creditcard', brand: label, last4: number ? number.slice(-4) : null }
    }
    if (method === 'paypal') return { state: 'ok', method: 'paypal', brand: null, last4: null }
    return { state: 'ok', method: 'other', brand: null, last4: null }
  } catch (err) {
    console.error('[billing] mandate fetch failed', err instanceof Error ? err.message : err)
    return { state: 'unavailable' }
  }
}

// ── Cancellation ────────────────────────────────────────────────────────────

export const CANCEL_REASONS = [
  'too_expensive',
  'missing_features',
  'closing_or_pausing',
  'switching_provider',
  'other',
] as const
export type CancelReason = (typeof CANCEL_REASONS)[number]

export type CancelInput = { reason: CancelReason; details: string }

export function parseCancelInput(body: unknown): CancelInput | null {
  if (!body || typeof body !== 'object') return null
  const { reason, details } = body as { reason?: unknown; details?: unknown }
  if (typeof reason !== 'string' || !(CANCEL_REASONS as readonly string[]).includes(reason)) return null
  const text = typeof details === 'string' ? details.trim() : ''
  if (text.length > 500) return null
  if (reason === 'other' && text.length === 0) return null
  return { reason: reason as CancelReason, details: text }
}

/** The one Mollie operation cancellation needs — injectable so tests can stub it. */
export type SubscriptionCanceller = (customerId: string, subscriptionId: string) => Promise<void>

export const cancelMollieSubscription: SubscriptionCanceller = async (customerId, subscriptionId) => {
  await getMolliePlatformClient().customerSubscriptions.cancel(subscriptionId, { customerId })
}

export type CancelResult =
  | { ok: true; endsOn: string | null }
  | { ok: false; code: 'no_subscription' | 'nothing_to_cancel' | 'already_cancelled' | 'mollie_failed' | 'db_error' }

/**
 * Mollie first; only if that succeeds is anything written. `status` is left as
 * is — period-end handling belongs to D6.5.
 */
export async function cancelSubscription(args: {
  admin: SupabaseClient
  restaurantId: string
  input: CancelInput
  cancelAtMollie?: SubscriptionCanceller
}): Promise<CancelResult & { subscriptionId?: string }> {
  const { admin, restaurantId, input } = args
  const cancelAtMollie = args.cancelAtMollie ?? cancelMollieSubscription

  const { data: sub } = await admin
    .from('subscriptions')
    .select(SUBSCRIPTION_COLUMNS)
    .eq('restaurant_id', restaurantId)
    .maybeSingle<SubscriptionRow>()

  if (!sub) return { ok: false, code: 'no_subscription' }
  if (sub.cancelled_at) return { ok: false, code: 'already_cancelled' }
  if (!sub.mollie_customer_id || !sub.mollie_subscription_id) {
    return { ok: false, code: 'nothing_to_cancel' }
  }

  try {
    await cancelAtMollie(sub.mollie_customer_id, sub.mollie_subscription_id)
  } catch (err) {
    console.error('[billing] mollie cancel failed', err instanceof Error ? err.message : err)
    return { ok: false, code: 'mollie_failed' }
  }

  const reason = input.details ? `${input.reason}: ${input.details}` : input.reason
  const { error } = await admin
    .from('subscriptions')
    .update({ cancelled_at: new Date().toISOString(), cancellation_reason: reason })
    .eq('id', sub.id)
    .eq('restaurant_id', restaurantId)
  if (error) {
    console.error('[billing] cancelled at Mollie but DB write failed', error.message)
    return { ok: false, code: 'db_error', subscriptionId: sub.id }
  }

  return { ok: true, endsOn: sub.current_period_end ?? sub.trial_ends_at, subscriptionId: sub.id }
}

/** 'live' | 'test' from Mollie's own record of the payment; null when it can't be determined. */
export async function lookupPaymentMode(molliePaymentId: string): Promise<'live' | 'test' | null> {
  try {
    const p = await withTimeout(getMolliePlatformClient().payments.get(molliePaymentId), MANDATE_TIMEOUT_MS)
    return p.mode === 'live' ? 'live' : p.mode === 'test' ? 'test' : null
  } catch {
    return null
  }
}
