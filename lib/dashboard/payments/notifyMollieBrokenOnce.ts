import 'server-only'

import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'
import { sendConsumerEmail } from '@/lib/consumer/email/send'
import { resolveRestaurantRecipient } from '@/lib/notifications/restaurant/resolveRecipient'
import { renderRestaurantMollieBroken } from '@/lib/notifications/restaurant/templates/mollieBroken'
import { isMollieBrokenRow, MOLLIE_CONNECTION_COLUMNS, type MollieConnectionRow } from './connectionStatus'

export const MOLLIE_BROKEN_TEMPLATE_KEY = 'restaurant.mollie_broken'
const BASE_URL = 'https://thetafel.nl'
const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000

export type NotifyMollieBrokenResult =
  | { sent: true }
  | { sent: false; reason: 'not_broken' | 'already_sent' | 'no_recipient' | 'send_failed' | 'error' }

/**
 * Emails the restaurant's contact address that its Mollie connection is
 * broken — at most once per 24h (keyed on a prior `email.sent` audit row for
 * this templateKey). A restaurant that never connected is NOT broken and never
 * gets this email: the stored row must satisfy isMollieBrokenRow, or the
 * caller must have observed a live auth failure (`liveExpired`) on a
 * restaurant that has a Mollie organization.
 *
 * Never throws; meant to run inside after().
 */
export async function notifyMollieBrokenOnce(
  restaurantId: string,
  opts: { liveExpired?: boolean } = {},
): Promise<NotifyMollieBrokenResult> {
  try {
    const admin = await createSupabaseServerClientAdmin()

    const { data: row } = await admin
      .from('restaurants')
      .select(MOLLIE_CONNECTION_COLUMNS)
      .eq('id', restaurantId)
      .maybeSingle<MollieConnectionRow>()

    if (!row) return { sent: false, reason: 'error' }

    const broken = opts.liveExpired
      ? row.mollie_organization_id !== null && row.mollie_status === 'verified'
      : isMollieBrokenRow(row, new Date())
    if (!broken) return { sent: false, reason: 'not_broken' }

    const since = new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString()
    const { data: recent } = await admin
      .from('consumer_audit_logs')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .eq('event_type', 'email.sent')
      .eq('event_data->>templateKey', MOLLIE_BROKEN_TEMPLATE_KEY)
      .gte('created_at', since)
      .limit(1)

    if (recent && recent.length > 0) return { sent: false, reason: 'already_sent' }

    const r = await resolveRestaurantRecipient(restaurantId)
    if (!r || !r.email) return { sent: false, reason: 'no_recipient' }

    const localePrefix = r.locale === 'en' ? '/en' : ''
    const rendered = renderRestaurantMollieBroken({
      locale: r.locale,
      restaurantName: r.restaurantName,
      paymentsUrl: `${BASE_URL}${localePrefix}/dashboard/settings/payments`,
    })

    const send = await sendConsumerEmail({
      to: r.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      templateKey: MOLLIE_BROKEN_TEMPLATE_KEY,
      restaurantId,
      skipAdminBcc: true,
    })

    return send.ok ? { sent: true } : { sent: false, reason: 'send_failed' }
  } catch (err) {
    console.error('[notifyMollieBrokenOnce] unexpected error', err)
    return { sent: false, reason: 'error' }
  }
}
