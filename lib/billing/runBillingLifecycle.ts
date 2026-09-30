import 'server-only'

import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'
import { sendConsumerEmail } from '@/lib/consumer/email/send'
import { resolveRestaurantRecipient } from '@/lib/notifications/restaurant/resolveRecipient'
import {
  renderBillingEmail,
  type BillingEmailKind,
} from '@/lib/notifications/restaurant/templates/billingLifecycle'
import {
  GRACE_EMAIL_DAYS,
  decideLifecycle,
  suspensionDate,
  type GraceEmailDay,
  type RestaurantFacts,
  type RestaurantPatch,
  type SubscriptionFacts,
  type SubscriptionPatch,
} from './lifecycle'

/**
 * The daily billing lifecycle job (D6.5). Called by POST /api/cron/billing-lifecycle
 * (pg_cron, scheduled outside this repo). Idempotent: a re-run the same day
 * sends nothing new and changes nothing, because every decision comes from the
 * pure `decideLifecycle` over current DB state plus the `email.sent` audit trail.
 *
 *   1. day 1 / 7 / 12 of a past_due grace period → one owner email each
 *   2. day 14 → subscription `suspended`, restaurant paused (`billing_suspended`)
 *   3. cancelled subscription reaching period end → `cancelled`, restaurant paused
 *      (`subscription_cancelled`)
 *
 * Each restaurant is processed in its own try/catch. Restaurant patches are
 * written BEFORE the subscription patch, so a half-failed run is retried on the
 * next one (the subscription is still past_due / not yet ended) instead of
 * leaving a suspended subscription next to a live restaurant.
 */

const BASE_URL = 'https://thetafel.nl'

export type BillingLifecycleCounts = { graceEmails: number; suspended: number; ended: number; errors: number }

type SubRow = SubscriptionFacts & { id: string; restaurant_id: string }

const SUB_SELECT = 'id, restaurant_id, status, trial_ends_at, current_period_end, cancelled_at'

const graceKey = (day: GraceEmailDay) => `restaurant.billing_failed_d${day}`

function formatDate(iso: string, locale: 'nl' | 'en'): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'nl-NL', {
    timeZone: 'Europe/Amsterdam',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso))
}

async function audit(
  admin: Awaited<ReturnType<typeof createSupabaseServerClientAdmin>>,
  restaurantId: string,
  eventType: string,
  data: Record<string, unknown>,
) {
  try {
    await admin.from('audit_logs').insert({ restaurant_id: restaurantId, event_type: eventType, event_data: data })
  } catch {
    // never fail the run over an audit row
  }
}

async function sendBillingEmail(
  restaurantId: string,
  kind: BillingEmailKind,
  templateKey: string,
  graceStartedAt: string,
): Promise<boolean> {
  const r = await resolveRestaurantRecipient(restaurantId)
  if (!r || !r.email) return false
  const localePrefix = r.locale === 'en' ? '/en' : ''
  const rendered = renderBillingEmail({
    kind,
    locale: r.locale,
    restaurantName: r.restaurantName,
    offlineDate: formatDate(suspensionDate(graceStartedAt), r.locale),
    billingUrl: `${BASE_URL}${localePrefix}/dashboard/settings/billing`,
  })
  const send = await sendConsumerEmail({
    to: r.email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    templateKey,
    restaurantId,
    skipAdminBcc: true,
  })
  return send.ok
}

export async function runBillingLifecycle(now: Date = new Date()): Promise<BillingLifecycleCounts> {
  const admin = await createSupabaseServerClientAdmin()
  const counts: BillingLifecycleCounts = { graceEmails: 0, suspended: 0, ended: 0, errors: 0 }
  const nowIso = now.toISOString()

  const [pastDue, cancelling] = await Promise.all([
    admin.from('subscriptions').select(SUB_SELECT).eq('status', 'past_due').returns<SubRow[]>(),
    admin
      .from('subscriptions')
      .select(SUB_SELECT)
      .not('cancelled_at', 'is', null)
      .neq('status', 'cancelled')
      .returns<SubRow[]>(),
  ])
  if (pastDue.error || cancelling.error) {
    console.error('[billing-lifecycle] subscription query failed', pastDue.error?.message, cancelling.error?.message)
    counts.errors += 1
    return counts
  }
  const subs = new Map<string, SubRow>()
  for (const s of [...(pastDue.data ?? []), ...(cancelling.data ?? [])]) subs.set(s.id, s)

  for (const sub of subs.values()) {
    try {
      const { data: restaurant } = await admin
        .from('restaurants')
        .select('grace_period_started_at, paused_at, pause_reason')
        .eq('id', sub.restaurant_id)
        .maybeSingle<RestaurantFacts>()
      if (!restaurant) continue

      // Which grace emails went out during THIS grace episode.
      let alreadySent: GraceEmailDay[] = []
      if (restaurant.grace_period_started_at) {
        const { data: sent } = await admin
          .from('consumer_audit_logs')
          .select('event_data')
          .eq('restaurant_id', sub.restaurant_id)
          .eq('event_type', 'email.sent')
          .in('event_data->>templateKey', GRACE_EMAIL_DAYS.map(graceKey))
          .gte('created_at', restaurant.grace_period_started_at)
        const keys = new Set((sent ?? []).map((row) => (row.event_data as { templateKey?: string })?.templateKey))
        alreadySent = GRACE_EMAIL_DAYS.filter((d) => keys.has(graceKey(d)))
      }

      const decision = decideLifecycle({ sub, restaurant, now: nowIso, alreadySent })

      if (decision.action === 'grace_email') {
        const ok = await sendBillingEmail(
          sub.restaurant_id,
          `failed_d${decision.day}` as BillingEmailKind,
          graceKey(decision.day),
          restaurant.grace_period_started_at as string,
        )
        if (ok) counts.graceEmails += 1
      } else if (decision.action === 'suspend' || decision.action === 'end') {
        await applyPatches(admin, sub, decision.restaurant, decision.subscription)
        if (decision.action === 'suspend') {
          counts.suspended += 1
          await audit(admin, sub.restaurant_id, 'billing.suspended', {
            subscription_id: sub.id,
            restaurant_paused: Object.keys(decision.restaurant).length > 0,
          })
          await sendBillingEmail(
            sub.restaurant_id,
            'suspended',
            'restaurant.billing_suspended',
            restaurant.grace_period_started_at as string,
          )
        } else {
          counts.ended += 1
          await audit(admin, sub.restaurant_id, 'billing.subscription_ended', {
            subscription_id: sub.id,
            restaurant_paused: Object.keys(decision.restaurant).length > 0,
          })
        }
      }
    } catch (err) {
      counts.errors += 1
      console.error('[billing-lifecycle] restaurant failed', sub.restaurant_id, err instanceof Error ? err.message : err)
    }
  }

  return counts
}

async function applyPatches(
  admin: Awaited<ReturnType<typeof createSupabaseServerClientAdmin>>,
  sub: SubRow,
  restaurantPatch: RestaurantPatch,
  subscriptionPatch: SubscriptionPatch,
) {
  if (Object.keys(restaurantPatch).length > 0) {
    const { error } = await admin.from('restaurants').update(restaurantPatch).eq('id', sub.restaurant_id)
    if (error) throw new Error(`restaurant_update_failed: ${error.message}`)
  }
  const { error } = await admin.from('subscriptions').update(subscriptionPatch).eq('id', sub.id)
  if (error) throw new Error(`subscription_update_failed: ${error.message}`)
}
