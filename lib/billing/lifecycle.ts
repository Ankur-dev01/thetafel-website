/**
 * Subscription lifecycle state machine (D6.5) — PURE functions only.
 *
 * Nothing here reads the clock, the DB or Mollie: callers pass facts in and get
 * back the patches to write. The webhook (recurring charges) and the daily
 * billing cron both use these, so the money rules live in one testable place.
 *
 *   trialing ──paid──▶ active ◀──paid── past_due ──day 14──▶ suspended
 *                                          ▲                     │
 *                                     failed charge         paid → un-pause
 */

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled'

export type SubscriptionFacts = {
  status: SubscriptionStatus
  trial_ends_at: string | null
  current_period_end: string | null
  cancelled_at: string | null
}

export type RestaurantFacts = {
  grace_period_started_at: string | null
  paused_at: string | null
  pause_reason: string | null
}

export type SubscriptionPatch = Partial<{
  status: SubscriptionStatus
  current_period_start: string
  current_period_end: string
  next_charge_at: string
  suspended_at: string | null
  cancelled_at: string
}>

export type RestaurantPatch = Partial<{
  grace_period_started_at: string | null
  paused_at: string | null
  paused_by: string | null
  pause_reason: string | null
}>

export type Transition = {
  subscription: SubscriptionPatch
  restaurant: RestaurantPatch
  /** Audit event names describing what the patches mean (caller writes them). */
  events: string[]
}

/**
 * pause_reason written when a cancelled subscription reaches period end.
 * The spec calls for 'subscription_cancelled', but restaurants_pause_reason_check
 * only allows ('manual', 'billing_suspended') and this batch may not migrate —
 * so the ended restaurant is paused as 'billing_suspended'. The subscription's
 * own status ('cancelled') is the discriminator, and onRecurringPaid never
 * un-pauses a cancelled subscription. Once the CHECK is extended, change this
 * one constant (resume route + PauseControl already understand both values).
 */
export const ENDED_PAUSE_REASON = 'billing_suspended'

export const GRACE_DAYS_TO_SUSPEND = 14
export const GRACE_EMAIL_DAYS = [1, 7, 12] as const
export type GraceEmailDay = (typeof GRACE_EMAIL_DAYS)[number]

const DAY_MS = 86_400_000

/** +1 calendar month in UTC, clamped to the target month's last day (31 Jan → 28/29 Feb). */
export function addOneMonth(iso: string): string {
  const d = new Date(iso)
  const day = d.getUTCDate()
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds()))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(day, lastDay))
  return target.toISOString()
}

/** Mollie's nextPaymentDate is a plain date (YYYY-MM-DD); store it as that day at 00:00 UTC. */
function dateOnlyToIso(dateOnly: string | null | undefined): string | null {
  if (!dateOnly || !/^\d{4}-\d{2}-\d{2}/.test(dateOnly)) return null
  const d = new Date(`${dateOnly.slice(0, 10)}T00:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/**
 * A recurring charge was PAID.
 *  - trialing / past_due / suspended / active → active, new period, grace cleared
 *  - a billing_suspended pause is lifted (a manual pause is left alone)
 *  - a subscription already `cancelled` (period ended) keeps that status
 */
export function onRecurringPaid(input: {
  sub: SubscriptionFacts
  restaurant: RestaurantFacts
  paidAt: string
  /** Mollie's nextPaymentDate (YYYY-MM-DD), if known. */
  nextPaymentDate?: string | null
}): Transition {
  const { sub, restaurant, paidAt } = input
  const events: string[] = []
  const subscription: SubscriptionPatch = {}
  const rPatch: RestaurantPatch = {}

  const periodEnd = addOneMonth(paidAt)
  if (sub.status !== 'cancelled') {
    subscription.status = 'active'
    if (sub.status !== 'active') events.push(`subscription.${sub.status}_to_active`)
    if (sub.status === 'suspended') subscription.suspended_at = null
  }
  subscription.current_period_start = paidAt
  subscription.current_period_end = periodEnd
  subscription.next_charge_at = dateOnlyToIso(input.nextPaymentDate) ?? periodEnd

  if (restaurant.grace_period_started_at !== null) {
    rPatch.grace_period_started_at = null
    events.push('billing.grace_cleared')
  }
  if (restaurant.paused_at !== null && restaurant.pause_reason === 'billing_suspended' && sub.status !== 'cancelled') {
    rPatch.paused_at = null
    rPatch.paused_by = null
    rPatch.pause_reason = null
    events.push('billing.restaurant_unpaused')
  }

  return { subscription, restaurant: rPatch, events }
}

/**
 * A recurring charge FAILED (failed / expired / canceled at Mollie).
 *  - active / trialing → past_due; the first failure starts the grace clock
 *  - a later failure keeps the original grace start
 *  - suspended / cancelled are never moved back to past_due
 */
export function onRecurringFailed(input: {
  sub: SubscriptionFacts
  restaurant: RestaurantFacts
  now: string
}): Transition {
  const { sub, restaurant, now } = input
  const events: string[] = []
  const subscription: SubscriptionPatch = {}
  const rPatch: RestaurantPatch = {}

  if (sub.status === 'suspended' || sub.status === 'cancelled') {
    return { subscription, restaurant: rPatch, events }
  }
  if (sub.status !== 'past_due') {
    subscription.status = 'past_due'
    events.push(`subscription.${sub.status}_to_past_due`)
  }
  if (restaurant.grace_period_started_at === null) {
    rPatch.grace_period_started_at = now
    events.push('billing.grace_started')
  }
  return { subscription, restaurant: rPatch, events }
}

/** Mollie cancelled the subscription: remember it; the lifecycle job ends it at period end. */
export function onSubscriptionCancelledAtMollie(input: { sub: SubscriptionFacts; now: string }): SubscriptionPatch {
  return input.sub.cancelled_at === null ? { cancelled_at: input.now } : {}
}

// ── Daily lifecycle job decisions ───────────────────────────────────────────

/** Whole elapsed days since the grace clock started (0 before 24h have passed). */
export function graceDay(graceStartedAt: string, now: string): number {
  const diff = new Date(now).getTime() - new Date(graceStartedAt).getTime()
  return diff <= 0 ? 0 : Math.floor(diff / DAY_MS)
}

/** When the restaurant goes offline: grace start + 14 days. */
export function suspensionDate(graceStartedAt: string): string {
  return new Date(new Date(graceStartedAt).getTime() + GRACE_DAYS_TO_SUSPEND * DAY_MS).toISOString()
}

/**
 * The single grace email due today, or null. It is the highest milestone (1, 7,
 * 12) already reached — so a missed cron run never back-fills an older, stale
 * email — and only if it hasn't been sent yet. Day 14+ is suspension, not email.
 */
export function dueGraceEmail(input: { day: number; alreadySent: readonly GraceEmailDay[] }): GraceEmailDay | null {
  if (input.day >= GRACE_DAYS_TO_SUSPEND) return null
  const reached = [...GRACE_EMAIL_DAYS].filter((d) => d <= input.day)
  const milestone = reached.length ? reached[reached.length - 1] : null
  if (milestone === null) return null
  return input.alreadySent.includes(milestone) ? null : milestone
}

export type LifecycleDecision =
  | { action: 'none' }
  | { action: 'grace_email'; day: GraceEmailDay }
  | { action: 'suspend'; subscription: SubscriptionPatch; restaurant: RestaurantPatch }
  | { action: 'end'; subscription: SubscriptionPatch; restaurant: RestaurantPatch }

/**
 * What the daily job should do for one restaurant. Order matters: a cancelled
 * subscription reaching period end is ended before anything grace-related.
 * A restaurant that is ALREADY paused (manual pause, or an earlier billing
 * pause) keeps its paused_at / pause_reason — only a live restaurant gets one.
 */
export function decideLifecycle(input: {
  sub: SubscriptionFacts
  restaurant: RestaurantFacts
  now: string
  alreadySent: readonly GraceEmailDay[]
}): LifecycleDecision {
  const { sub, restaurant, now } = input

  if (sub.cancelled_at !== null && sub.status !== 'cancelled') {
    const endsAt = sub.current_period_end ?? sub.trial_ends_at
    if (endsAt && new Date(now).getTime() >= new Date(endsAt).getTime()) {
      return {
        action: 'end',
        subscription: { status: 'cancelled' },
        restaurant:
          restaurant.paused_at === null ? { paused_at: now, pause_reason: ENDED_PAUSE_REASON } : {},
      }
    }
    return { action: 'none' }
  }

  if (sub.status !== 'past_due' || restaurant.grace_period_started_at === null) return { action: 'none' }

  const day = graceDay(restaurant.grace_period_started_at, now)
  if (day >= GRACE_DAYS_TO_SUSPEND) {
    return {
      action: 'suspend',
      subscription: { status: 'suspended', suspended_at: now },
      restaurant:
        restaurant.paused_at === null ? { paused_at: now, pause_reason: 'billing_suspended' } : {},
    }
  }

  const due = dueGraceEmail({ day, alreadySent: input.alreadySent })
  return due === null ? { action: 'none' } : { action: 'grace_email', day: due }
}
