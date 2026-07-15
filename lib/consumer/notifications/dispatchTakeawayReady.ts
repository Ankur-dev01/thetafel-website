// lib/consumer/notifications/dispatchTakeawayReady.ts
//
// Called by Phase 3's staff dashboard when an order is marked ready.
// In Phase 2, no code path calls this — verify manually by invoking
// sendTakeawayReadyEmail(orderId) from a script.
//
// Guards against double-sending via orders.ready_notified_at (set on first
// successful send). Mints a fresh view-order magic link at send time rather
// than requiring the caller to supply one — the original checkout-flow
// token is never persisted in plaintext past the initial HTTP response, so
// this is the only way to hand the guest a working link days later.

import 'server-only'
import { auditLog } from '../audit'
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'
import { createMagicLink } from '../magicLinks'
import { renderTakeawayReadyForPickup } from '../email/templates/takeawayReadyForPickup'
import { sendConsumerEmail } from '../email/send'
import type { EmailLocale } from '../email/layout'

export type DispatchResult =
  | { ok: true; emailId: string }
  | { ok: false; error: string }

function formatAddress(r: {
  legal_address_street: string | null
  legal_address_house_number: string | null
  legal_address_house_letter: string | null
  legal_address_house_number_addition: string | null
  legal_address_postcode: string | null
  legal_address_city: string | null
}): { line1: string; line2: string } | null {
  const street = r.legal_address_street ?? ''
  const num = r.legal_address_house_number ?? ''
  const letter = r.legal_address_house_letter ?? ''
  const addition = r.legal_address_house_number_addition ?? ''
  const numWithSuffix = `${num}${letter}${addition ? `-${addition}` : ''}`.trim()
  const line1 = [street, numWithSuffix].filter(Boolean).join(' ').trim()
  const line2 = [r.legal_address_postcode, r.legal_address_city].filter(Boolean).join(' ').trim()
  if (!line1 && !line2) return null
  return { line1, line2 }
}

export async function sendTakeawayReadyEmail(
  orderId: string,
  locale: EmailLocale = 'nl',
): Promise<DispatchResult> {
  const admin = await createSupabaseServerClientAdmin()

  const { data: order, error: orderErr } = await admin
    .from('orders')
    .select('id, restaurant_id, order_ref, guest_id, ready_notified_at')
    .eq('id', orderId)
    .maybeSingle()

  if (orderErr || !order || !order.guest_id) {
    const error = orderErr?.message ?? 'order or guest_id missing'
    console.error('[dispatchTakeawayReady] order lookup failed', error)
    return { ok: false, error }
  }

  if (order.ready_notified_at) {
    return { ok: false, error: 'already_notified' }
  }

  const [{ data: guest }, { data: restaurant }] = await Promise.all([
    admin.from('guests').select('full_name, email').eq('id', order.guest_id).maybeSingle(),
    admin
      .from('restaurants')
      .select(
        'slug, display_name, legal_name, contact_phone, legal_address_street, legal_address_house_number, legal_address_house_letter, legal_address_house_number_addition, legal_address_postcode, legal_address_city',
      )
      .eq('id', order.restaurant_id)
      .maybeSingle(),
  ])

  if (!guest || !restaurant) {
    const error = 'guest or restaurant not found'
    console.error('[dispatchTakeawayReady]', error, { orderId })
    return { ok: false, error }
  }

  const restaurantName = restaurant.display_name ?? restaurant.legal_name ?? 'Restaurant'

  const link = await createMagicLink({
    purpose: 'view_order',
    orderId: order.id,
    restaurantId: order.restaurant_id,
  })
  if (!link.ok) {
    return { ok: false, error: `magic_link_failed:${link.reason}` }
  }

  const localePrefix = locale === 'en' ? '/en' : ''
  const publicBaseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://thetafel.nl'
  const viewOrderUrl = `${publicBaseUrl}${localePrefix}/r/${restaurant.slug}/order/confirmed/${link.token}`

  let result: DispatchResult
  try {
    const rendered = renderTakeawayReadyForPickup({
      locale,
      guestFullName: guest.full_name,
      restaurantName,
      restaurantPhone: restaurant.contact_phone,
      restaurantAddress: formatAddress(restaurant),
      orderRef: order.order_ref,
      viewOrderUrl,
    })

    const send = await sendConsumerEmail({
      to: guest.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      templateKey: 'takeaway.ready_for_pickup',
      restaurantId: order.restaurant_id,
      orderId: order.id,
    })

    result = send.ok ? { ok: true, emailId: send.resendId } : { ok: false, error: send.error ?? send.reason }
  } catch (err) {
    console.error('[dispatchTakeawayReady] failed', err)
    result = { ok: false, error: err instanceof Error ? err.message : String(err) }
  }

  if (result.ok) {
    await admin.from('orders').update({ ready_notified_at: new Date().toISOString() }).eq('id', order.id)
  }

  await auditLog({
    restaurantId: order.restaurant_id,
    eventType: 'notification.dispatched',
    eventData: {
      intent: 'takeaway_ready_for_pickup',
      locale,
      orderRef: order.order_ref,
      email: { ok: result.ok, id: result.ok ? result.emailId : null, error: result.ok ? null : result.error },
    },
    actorType: 'system',
    orderId: order.id,
  }).catch(() => {})

  return result
}
