// lib/notifications/restaurant/dispatchNewOrder.ts
//
// Sends the restaurant-facing "new takeaway order" email (D5.6b). Called
// from app/api/webhooks/mollie/consumer/route.ts's handlePaid(), inside
// the takeaway_order branch, in its own after() block after the guest
// confirmation email. Does its own order/guest/items lookup — the webhook
// only has an orderId, same pattern as dispatchTakeawayConfirmation.ts.

import 'server-only'
import { auditLog } from '@/lib/consumer/audit'
import { sendConsumerEmail } from '@/lib/consumer/email/send'
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'
import { resolveRestaurantRecipient } from './resolveRecipient'
import { renderRestaurantNewOrder } from './templates/newOrder'

const TEMPLATE_KEY = 'restaurant.new_order'
const BASE_URL = 'https://thetafel.nl'

export type DispatchResult = {
  ok: boolean
  skipped?: 'restaurant_disabled' | 'no_recipient'
  emailId?: string
  error?: string
}

function dashboardUrl(path: string, locale: 'nl' | 'en'): string {
  const localePrefix = locale === 'en' ? '/en' : ''
  return `${BASE_URL}${localePrefix}${path}`
}

export async function sendRestaurantNewOrderEmail(orderId: string): Promise<DispatchResult> {
  try {
    const admin = await createSupabaseServerClientAdmin()

    const { data: order, error: orderErr } = await admin
      .from('orders')
      .select('id, restaurant_id, order_ref, guest_id, pickup_time, total_cents, currency')
      .eq('id', orderId)
      .maybeSingle()

    if (orderErr || !order || !order.guest_id) {
      const error = orderErr?.message ?? 'order or guest_id missing'
      console.error('[restaurantNotify:new_order] order lookup failed', error)
      return { ok: false, error }
    }

    const [{ data: guest }, { data: items }] = await Promise.all([
      admin.from('guests').select('full_name, email, phone').eq('id', order.guest_id).maybeSingle(),
      admin
        .from('order_items')
        .select('name_snapshot, quantity, line_total_cents')
        .eq('order_id', orderId),
    ])

    if (!guest) {
      console.error('[restaurantNotify:new_order] guest not found', { orderId })
      return { ok: false, error: 'guest_not_found' }
    }

    const r = await resolveRestaurantRecipient(order.restaurant_id)
    if (!r) {
      console.error('[restaurantNotify:new_order] restaurant not found', {
        restaurantId: order.restaurant_id,
      })
      return { ok: false, error: 'restaurant_not_found' }
    }

    if (!r.toggles.newOrder) {
      await auditLog({
        restaurantId: order.restaurant_id,
        eventType: 'email.skipped',
        eventData: { templateKey: TEMPLATE_KEY, reason: 'restaurant_disabled' },
        actorType: 'system',
        orderId: order.id,
      }).catch(() => {})
      return { ok: true, skipped: 'restaurant_disabled' }
    }

    if (!r.email) {
      await auditLog({
        restaurantId: order.restaurant_id,
        eventType: 'email.skipped',
        eventData: { templateKey: TEMPLATE_KEY, reason: 'no_recipient' },
        actorType: 'system',
        orderId: order.id,
      }).catch(() => {})
      return { ok: true, skipped: 'no_recipient' }
    }

    const rendered = renderRestaurantNewOrder({
      locale: r.locale,
      restaurantName: r.restaurantName,
      orderRef: order.order_ref,
      pickupTime: order.pickup_time ?? new Date().toISOString(),
      items: (items ?? []).map((i) => ({
        name: i.name_snapshot,
        quantity: i.quantity,
        lineTotalCents: i.line_total_cents,
      })),
      totalCents: order.total_cents,
      currency: order.currency,
      guestFullName: guest.full_name,
      guestPhone: guest.phone,
      orderUrl: dashboardUrl(`/dashboard/orders?order=${order.id}`, r.locale),
      settingsUrl: dashboardUrl('/dashboard/settings/notifications', r.locale),
    })

    const send = await sendConsumerEmail({
      to: r.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      templateKey: TEMPLATE_KEY,
      restaurantId: order.restaurant_id,
      orderId: order.id,
      skipAdminBcc: true,
      ...(guest.email ? { replyTo: guest.email } : {}),
    })

    return send.ok
      ? { ok: true, emailId: send.resendId }
      : { ok: false, error: send.error ?? send.reason }
  } catch (err) {
    console.error('[restaurantNotify:new_order] unexpected error', err)
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
