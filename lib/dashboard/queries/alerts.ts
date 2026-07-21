import 'server-only'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { StaffRole } from '@/lib/dashboard/nav'
import type { DashboardAlert } from '@/lib/dashboard/alerts/types'

/**
 * The six Vandaag alert checks (PRD §4.1), in priority order. Each check is
 * independent and swallows its own query errors (logged, not thrown) so one
 * broken check never hides the other five. Read-only; no mutations, no
 * audits — see the D1.2 prompt's security checklist.
 */

const TEN_MINUTES_MS = 10 * 60 * 1000
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000

// ---------------------------------------------------------------------------
// Alert 1 — mollie_broken (priority 1, danger)
// ---------------------------------------------------------------------------

/**
 * There is no separate `mollie_oauth_tokens` table (confirmed against the
 * live schema for D1.2) — the operational connection state lives directly
 * on `restaurants`: `mollie_status` (not_started/pending/verified/rejected/
 * needs_action), `mollie_access_token`, `mollie_token_expires_at`.
 *
 * "Broken" means a connection that existed and stopped working, not a
 * restaurant that never connected:
 *   - status is 'rejected' or 'needs_action' (Mollie itself flagged the org), or
 *   - status is 'verified' but the access token is missing, or the token has
 *     expired.
 * 'not_started' / 'pending' never fire — that's onboarding, not breakage.
 *
 * Suppressed entirely while the restaurant is paused for billing — the pause
 * banner is the user-visible issue in that case; a second alert is noise.
 */
async function checkMollieBroken(
  restaurantId: string,
  now: Date,
  role: StaffRole
): Promise<DashboardAlert | null> {
  if (role !== 'owner' && role !== 'manager') return null

  try {
    const supabase = await createSupabaseServerClient()
    const { data: restaurant, error } = await supabase
      .from('restaurants')
      .select('mollie_status, mollie_access_token, mollie_token_expires_at, paused_at, pause_reason')
      .eq('id', restaurantId)
      .maybeSingle()

    if (error || !restaurant) throw error ?? new Error('restaurant not found')

    if (restaurant.paused_at !== null && restaurant.pause_reason === 'billing_suspended') {
      return null
    }

    const tokenExpired =
      restaurant.mollie_token_expires_at !== null &&
      new Date(restaurant.mollie_token_expires_at).getTime() < now.getTime()

    const broken =
      restaurant.mollie_status === 'rejected' ||
      restaurant.mollie_status === 'needs_action' ||
      (restaurant.mollie_status === 'verified' &&
        (restaurant.mollie_access_token === null || tokenExpired))

    if (!broken) return null

    return {
      id: 'mollie_broken',
      priority: 1,
      tone: 'danger',
      label_nl: 'Verbinding met Mollie is verbroken — betalingen werken niet.',
      label_en: 'Mollie connection is broken — payments are not working.',
      action_href: '/dashboard/settings/payments',
      action_label_nl: 'Herstel verbinding',
      action_label_en: 'Reconnect',
    }
  } catch (err) {
    console.error('[alerts] checkMollieBroken failed', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// Alert 2 — payments_failed_today (priority 2, warning)
// ---------------------------------------------------------------------------

async function checkPaymentsFailedToday(
  restaurantId: string,
  startOfTodayIso: string
): Promise<DashboardAlert | null> {
  try {
    const supabase = await createSupabaseServerClient()
    const { count, error } = await supabase
      .from('payment_intents')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .in('status', ['failed', 'cancelled'])
      .gte('created_at', startOfTodayIso)

    if (error) throw error
    const n = count ?? 0
    if (n === 0) return null

    return {
      id: 'payments_failed_today',
      priority: 2,
      tone: 'warning',
      label_nl: `${n} mislukte betaling${n === 1 ? '' : 'en'} vandaag.`,
      label_en: `${n} failed payment${n === 1 ? '' : 's'} today.`,
      action_href: '/dashboard/orders?filter=payment_failed',
      action_label_nl: 'Bekijk',
      action_label_en: 'View',
      meta: { count: n },
    }
  } catch (err) {
    console.error('[alerts] checkPaymentsFailedToday failed', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// Alert 3 — orders_ready_stale (priority 3, warning)
// ---------------------------------------------------------------------------

async function checkOrdersReadyStale(
  restaurantId: string,
  now: Date
): Promise<DashboardAlert | null> {
  try {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase
      .from('orders')
      .select('id, ready_notified_at, updated_at')
      .eq('restaurant_id', restaurantId)
      .eq('order_type', 'takeaway')
      .eq('status', 'ready')

    if (error) throw error

    // ready_notified_at isn't populated yet (the D3.2 notification path that
    // stamps it hasn't shipped) — fall back to updated_at per-row so this
    // alert is usable today, not dormant until D3.2 lands.
    const stale = (data ?? []).filter((row) => {
      const readyAt = new Date(row.ready_notified_at ?? row.updated_at)
      return now.getTime() - readyAt.getTime() > TEN_MINUTES_MS
    })

    if (stale.length === 0) return null
    const n = stale.length

    return {
      id: 'orders_ready_stale',
      priority: 3,
      tone: 'warning',
      label_nl: `${n} afhaalbestelling${n === 1 ? '' : 'en'} langer dan 10 minuten klaar.`,
      label_en: `${n} takeaway order${n === 1 ? '' : 's'} ready for over 10 minutes.`,
      action_href: '/dashboard/orders?filter=ready_stale',
      action_label_nl: 'Naar bestellingen',
      action_label_en: 'Go to orders',
      meta: { count: n },
    }
  } catch (err) {
    console.error('[alerts] checkOrdersReadyStale failed', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// Alert 4 — tabs_open_long (priority 4, warning)
// ---------------------------------------------------------------------------

async function checkTabsOpenLong(
  restaurantId: string,
  now: Date
): Promise<DashboardAlert | null> {
  try {
    const supabase = await createSupabaseServerClient()
    const cutoff = new Date(now.getTime() - FOUR_HOURS_MS).toISOString()

    const { count, error } = await supabase
      .from('tabs')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .eq('status', 'open')
      .lt('opened_at', cutoff)

    if (error) throw error
    const n = count ?? 0
    if (n === 0) return null

    return {
      id: 'tabs_open_long',
      priority: 4,
      tone: 'warning',
      label_nl: `${n} openstaande rekening${n === 1 ? '' : 'en'} langer dan 4 uur.`,
      label_en: `${n} tab${n === 1 ? '' : 's'} open for over 4 hours.`,
      action_href: '/dashboard/tabs',
      action_label_nl: 'Naar rekeningen',
      action_label_en: 'Go to tabs',
      meta: { count: n },
    }
  } catch (err) {
    console.error('[alerts] checkTabsOpenLong failed', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// Alert 5 — bookings_deposit_pending (priority 5, warning)
// ---------------------------------------------------------------------------

/**
 * `bookings` has no `deposit_status` column (confirmed against the live
 * schema) — only `deposit_amount_cents` and `deposit_intent_id`. "Pending"
 * means a deposit was required but the linked payment_intent (if any) never
 * reached 'paid'. The D6.2 deposit flow hasn't shipped yet, so most
 * bookings will have `deposit_intent_id IS NULL` while `deposit_amount_cents`
 * is set — that counts as pending too (required but not collected).
 */
async function checkBookingsDepositPending(
  restaurantId: string,
  now: Date
): Promise<DashboardAlert | null> {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: candidates, error } = await supabase
      .from('bookings')
      .select('id, deposit_intent_id')
      .eq('restaurant_id', restaurantId)
      .in('status', ['pending', 'confirmed'])
      .gte('slot_time', now.toISOString())
      .gt('deposit_amount_cents', 0)

    if (error) throw error
    const rows = candidates ?? []
    if (rows.length === 0) return null

    const intentIds = rows.map((r) => r.deposit_intent_id).filter((id): id is string => id !== null)

    let paidIntentIds = new Set<string>()
    if (intentIds.length > 0) {
      const { data: intents, error: intentsError } = await supabase
        .from('payment_intents')
        .select('id, status')
        .in('id', intentIds)
        .eq('status', 'paid')
      if (intentsError) throw intentsError
      paidIntentIds = new Set((intents ?? []).map((i) => i.id))
    }

    const pending = rows.filter(
      (r) => r.deposit_intent_id === null || !paidIntentIds.has(r.deposit_intent_id)
    )

    if (pending.length === 0) return null
    const n = pending.length

    return {
      id: 'bookings_deposit_pending',
      priority: 5,
      tone: 'warning',
      label_nl: `${n} reservering${n === 1 ? '' : 'en'} wacht op aanbetaling.`,
      label_en: `${n} booking${n === 1 ? '' : 's'} awaiting deposit payment.`,
      action_href: '/dashboard/bookings?filter=deposit_pending',
      action_label_nl: 'Bekijk',
      action_label_en: 'View',
      meta: { count: n },
    }
  } catch (err) {
    console.error('[alerts] checkBookingsDepositPending failed', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// Alert 6 — notifications_failed_today (priority 6, neutral)
// ---------------------------------------------------------------------------

/**
 * No dedicated notification-delivery table exists (confirmed against the
 * full live table list) — but email/WhatsApp send results ARE recorded, as
 * `consumer_audit_logs` rows with event_type 'email.send_failed' /
 * 'email.sent' / 'whatsapp.send_failed' / 'whatsapp.sent'. A send is only a
 * genuine failure if no later success exists for the same target — grouped
 * here by (booking_id, order_id) since there's no shared notification id;
 * a row with neither (a platform-level send) is judged on its own.
 */
async function checkNotificationsFailedToday(
  restaurantId: string,
  startOfTodayIso: string
): Promise<DashboardAlert | null> {
  try {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase
      .from('consumer_audit_logs')
      .select('id, event_type, booking_id, order_id, created_at')
      .eq('restaurant_id', restaurantId)
      .in('event_type', ['email.sent', 'email.send_failed', 'whatsapp.sent', 'whatsapp.send_failed'])
      .gte('created_at', startOfTodayIso)
      .order('created_at', { ascending: true })

    if (error) throw error
    const rows = data ?? []
    if (rows.length === 0) return null

    type Row = (typeof rows)[number]
    const groups = new Map<string, Row[]>()
    for (const row of rows) {
      const channel = row.event_type.startsWith('email') ? 'email' : 'whatsapp'
      const key = `${channel}:${row.booking_id ?? row.order_id ?? row.id}`
      const existing = groups.get(key)
      if (existing) existing.push(row)
      else groups.set(key, [row])
    }

    let failedGroups = 0
    for (const groupRows of groups.values()) {
      const last = groupRows[groupRows.length - 1]
      if (last.event_type.endsWith('send_failed')) failedGroups += 1
    }

    if (failedGroups === 0) return null
    const n = failedGroups

    return {
      id: 'notifications_failed_today',
      priority: 6,
      tone: 'neutral',
      label_nl: `${n} bericht${n === 1 ? '' : 'en'} kon vandaag niet worden bezorgd.`,
      label_en: `${n} message${n === 1 ? '' : 's'} failed to deliver today.`,
      action_href: '/dashboard/settings/notifications',
      action_label_nl: 'Bekijk',
      action_label_en: 'View',
      meta: { count: n },
    }
  } catch (err) {
    console.error('[alerts] checkNotificationsFailedToday failed', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

export async function getTodayAlerts(
  restaurantId: string,
  now: Date,
  role: StaffRole,
  startOfTodayIso: string
): Promise<DashboardAlert[]> {
  const results = await Promise.all([
    checkMollieBroken(restaurantId, now, role),
    checkPaymentsFailedToday(restaurantId, startOfTodayIso),
    checkOrdersReadyStale(restaurantId, now),
    checkTabsOpenLong(restaurantId, now),
    checkBookingsDepositPending(restaurantId, now),
    checkNotificationsFailedToday(restaurantId, startOfTodayIso),
  ])

  return results
    .filter((a): a is DashboardAlert => a !== null)
    .sort((a, b) => a.priority - b.priority)
}
