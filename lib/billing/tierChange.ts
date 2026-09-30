import 'server-only'

import { getMolliePlatformClient } from '@/lib/mollie/client'
import {
  buildRecurringDescription,
  formatMollieAmount,
  type SubscriptionTier,
} from '@/lib/pricing/subscription'

/**
 * A tier / amount change on an EXISTING subscription must never leave a Mollie
 * subscription charging the old amount (the Ankur mismatch: row says Premium,
 * Mollie still bills Plus). Rule: Mollie first, then the DB; if Mollie fails,
 * nothing is written. `assertTierWriteSynced` is the tripwire that makes the
 * rule impossible to forget at a call site.
 *
 * The only place a tier changes today is onboarding Step 12 checkout
 * (app/api/v1/restaurants/subscription/checkout/route.ts); the dashboard has no
 * plan-change flow yet (upgrade/downgrade is a later unit and must use this).
 */

export type SubscriptionRowForTier = {
  tier: SubscriptionTier
  monthly_amount_cents: number
  mollie_customer_id: string | null
  mollie_subscription_id: string | null
}

export type NextPlan = { tier: SubscriptionTier; monthlyAmountCents: number }

export type TierChangePlan = 'none' | 'db_only' | 'update_mollie' | 'cancel_mollie'

/** Pure: what has to happen at Mollie for this change. */
export function planTierChange(row: SubscriptionRowForTier, next: NextPlan): TierChangePlan {
  if (row.tier === next.tier && row.monthly_amount_cents === next.monthlyAmountCents) return 'none'
  if (!row.mollie_subscription_id) return 'db_only'
  return next.tier === 'starter' ? 'cancel_mollie' : 'update_mollie'
}

export class TierChangeNotSyncedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TierChangeNotSyncedError'
  }
}

/**
 * Tripwire at the DB write: throws if the tier/amount differs from the stored
 * row while a Mollie subscription exists and it was not synced first.
 */
export function assertTierWriteSynced(row: SubscriptionRowForTier, next: NextPlan, mollieSynced: boolean): void {
  const plan = planTierChange(row, next)
  if ((plan === 'update_mollie' || plan === 'cancel_mollie') && !mollieSynced) {
    throw new TierChangeNotSyncedError(
      `refusing to change subscription tier ${row.tier}→${next.tier} (amount ${row.monthly_amount_cents}→${next.monthlyAmountCents}) without updating Mollie subscription ${row.mollie_subscription_id}`,
    )
  }
}

/** The Mollie operations a tier change needs — injectable so tests never touch Mollie. */
export type MollieSubscriptionOps = {
  updateAmount: (args: {
    customerId: string
    subscriptionId: string
    amountValue: string
    description: string
  }) => Promise<void>
  cancel: (args: { customerId: string; subscriptionId: string }) => Promise<void>
}

export const platformSubscriptionOps: MollieSubscriptionOps = {
  async updateAmount({ customerId, subscriptionId, amountValue, description }) {
    await getMolliePlatformClient().customerSubscriptions.update(subscriptionId, {
      customerId,
      amount: { currency: 'EUR', value: amountValue },
      description,
    })
  },
  async cancel({ customerId, subscriptionId }) {
    await getMolliePlatformClient().customerSubscriptions.cancel(subscriptionId, { customerId })
  },
}

export type SyncResult = { ok: true; plan: TierChangePlan } | { ok: false; plan: TierChangePlan; error: string }

/** Do the Mollie side of a tier change. Never throws; ok:false means NOTHING may be written. */
export async function syncMollieForTierChange(args: {
  row: SubscriptionRowForTier
  next: NextPlan
  locale?: 'nl' | 'en'
  ops?: MollieSubscriptionOps
}): Promise<SyncResult> {
  const { row, next } = args
  const ops = args.ops ?? platformSubscriptionOps
  const plan = planTierChange(row, next)
  if (plan === 'none' || plan === 'db_only') return { ok: true, plan }

  if (!row.mollie_customer_id || !row.mollie_subscription_id) {
    return { ok: false, plan, error: 'missing_mollie_ids' }
  }
  try {
    if (plan === 'cancel_mollie') {
      await ops.cancel({ customerId: row.mollie_customer_id, subscriptionId: row.mollie_subscription_id })
    } else {
      await ops.updateAmount({
        customerId: row.mollie_customer_id,
        subscriptionId: row.mollie_subscription_id,
        amountValue: formatMollieAmount(next.monthlyAmountCents),
        description: buildRecurringDescription({ locale: args.locale ?? 'nl', tier: next.tier }),
      })
    }
    return { ok: true, plan }
  } catch (err) {
    console.error('[tierChange] Mollie sync failed', err instanceof Error ? err.message : err)
    return { ok: false, plan, error: err instanceof Error ? err.message : 'mollie_failed' }
  }
}
