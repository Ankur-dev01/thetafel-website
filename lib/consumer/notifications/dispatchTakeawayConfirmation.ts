// lib/consumer/notifications/dispatchTakeawayConfirmation.ts
//
// Sends the takeaway order-confirmed email. Called from the Mollie webhook's
// takeaway_order branch once payment lands (see
// app/api/webhooks/mollie/consumer/route.ts). Loads order + order_items +
// guest + restaurant itself — the webhook only has an orderId and the
// Mollie payment's redirectUrl (which is the only place the magic-link
// plaintext token survives after order creation; it's never persisted to
// the DB, only the hash is).
//
// No locale column exists on orders, so this defaults to 'nl' — the
// project's default locale everywhere else localePrefix is 'as-needed'.

import 'server-only'
import { auditLog } from '../audit'
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'
import { renderTakeawayOrderConfirmed } from '../email/templates/takeawayOrderConfirmed'
import { sendConsumerEmail } from '../email/send'
import type { EmailLocale } from '../email/layout'

export type DispatchResult = {
  ok: boolean
  emailId?: string
  error?: string
}

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

export async function sendTakeawayOrderConfirmedEmail(
  orderId: string,
  viewOrderUrl: string,
  locale: EmailLocale = 'nl',
): Promise<DispatchResult> {
  const admin = await createSupabaseServerClientAdmin()

  const { data: order, error: orderErr } = await admin
    .from('orders')
    .select('id, restaurant_id, order_ref, guest_id, pickup_time, total_cents, currency')
    .eq('id', orderId)
    .maybeSingle()

  if (orderErr || !order || !order.guest_id) {
    const error = orderErr?.message ?? 'order or guest_id missing'
    console.error('[dispatchTakeawayConfirmation] order lookup failed', error)
    return { ok: false, error }
  }

  const [{ data: guest }, { data: restaurant }, { data: items }] = await Promise.all([
    admin.from('guests').select('full_name, email').eq('id', order.guest_id).maybeSingle(),
    admin
      .from('restaurants')
      .select(
        'display_name, legal_name, contact_phone, legal_address_street, legal_address_house_number, legal_address_house_letter, legal_address_house_number_addition, legal_address_postcode, legal_address_city',
      )
      .eq('id', order.restaurant_id)
      .maybeSingle(),
    admin
      .from('order_items')
      .select('name_snapshot, quantity, line_total_cents')
      .eq('order_id', orderId),
  ])

  if (!guest || !restaurant) {
    const error = 'guest or restaurant not found'
    console.error('[dispatchTakeawayConfirmation]', error, { orderId })
    return { ok: false, error }
  }

  const restaurantName = restaurant.display_name ?? restaurant.legal_name ?? 'Restaurant'

  let result: DispatchResult
  try {
    const rendered = renderTakeawayOrderConfirmed({
      locale,
      guestFullName: guest.full_name,
      guestEmail: guest.email,
      restaurantName,
      restaurantPhone: restaurant.contact_phone,
      restaurantAddress: formatAddress(restaurant),
      orderRef: order.order_ref,
      pickupTime: order.pickup_time ?? new Date().toISOString(),
      items: (items ?? []).map((i) => ({
        name: i.name_snapshot,
        quantity: i.quantity,
        lineTotalCents: i.line_total_cents,
      })),
      totalCents: order.total_cents,
      currency: order.currency,
      viewOrderUrl,
    })

    const send = await sendConsumerEmail({
      to: guest.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      templateKey: 'takeaway.order_confirmed',
      restaurantId: order.restaurant_id,
      orderId: order.id,
    })

    result = send.ok
      ? { ok: true, emailId: send.resendId }
      : { ok: false, error: send.error ?? send.reason }
  } catch (err) {
    console.error('[dispatchTakeawayConfirmation] failed', err)
    result = { ok: false, error: err instanceof Error ? err.message : String(err) }
  }

  await auditLog({
    restaurantId: order.restaurant_id,
    eventType: 'notification.dispatched',
    eventData: {
      intent: 'takeaway_order_confirmation',
      locale,
      orderRef: order.order_ref,
      email: { ok: result.ok, id: result.emailId ?? null, error: result.error ?? null },
    },
    actorType: 'system',
    orderId: order.id,
  }).catch(() => {})

  return result
}
