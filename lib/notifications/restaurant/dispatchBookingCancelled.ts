// lib/notifications/restaurant/dispatchBookingCancelled.ts
//
// Sends the restaurant-facing "booking cancelled by guest" email (D5.6b).
// Called from app/api/v1/public/[slug]/book/cancel/route.ts in its own
// after() block, separate from the guest cancellation dispatcher.
//
// Guest-initiated cancellations only — staff-cancelled bookings never call
// this (the restaurant already knows; they did it themselves).

import 'server-only'
import { auditLog } from '@/lib/consumer/audit'
import { sendConsumerEmail } from '@/lib/consumer/email/send'
import { resolveRestaurantRecipient } from './resolveRecipient'
import { renderRestaurantBookingCancelled } from './templates/bookingCancelled'

const TEMPLATE_KEY = 'restaurant.booking_cancelled'
const BASE_URL = 'https://thetafel.nl'

export type SendRestaurantBookingCancelledEmailInput = {
  restaurantId: string
  bookingId: string
  bookingRef: string
  guestFullName: string
  guestEmail: string
  slotTime: Date | string
  partySize: number
  refundStatus: 'not_applicable' | 'refunded' | 'refund_failed'
  refundCents: number
  refundCurrency: string
}

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

export async function sendRestaurantBookingCancelledEmail(
  input: SendRestaurantBookingCancelledEmailInput
): Promise<DispatchResult> {
  try {
    const r = await resolveRestaurantRecipient(input.restaurantId)
    if (!r) {
      console.error('[restaurantNotify:booking_cancelled] restaurant not found', {
        restaurantId: input.restaurantId,
      })
      return { ok: false, error: 'restaurant_not_found' }
    }

    if (!r.toggles.bookingCancelled) {
      await auditLog({
        restaurantId: input.restaurantId,
        eventType: 'email.skipped',
        eventData: { templateKey: TEMPLATE_KEY, reason: 'restaurant_disabled' },
        actorType: 'system',
        bookingId: input.bookingId,
      }).catch(() => {})
      return { ok: true, skipped: 'restaurant_disabled' }
    }

    if (!r.email) {
      await auditLog({
        restaurantId: input.restaurantId,
        eventType: 'email.skipped',
        eventData: { templateKey: TEMPLATE_KEY, reason: 'no_recipient' },
        actorType: 'system',
        bookingId: input.bookingId,
      }).catch(() => {})
      return { ok: true, skipped: 'no_recipient' }
    }

    const rendered = renderRestaurantBookingCancelled({
      locale: r.locale,
      restaurantName: r.restaurantName,
      guestFullName: input.guestFullName,
      slotTime: input.slotTime,
      partySize: input.partySize,
      bookingRef: input.bookingRef,
      refundStatus: input.refundStatus,
      refundCents: input.refundCents,
      refundCurrency: input.refundCurrency,
      bookingUrl: dashboardUrl(`/dashboard/bookings?booking=${input.bookingId}`, r.locale),
      settingsUrl: dashboardUrl('/dashboard/settings/notifications', r.locale),
    })

    const send = await sendConsumerEmail({
      to: r.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      templateKey: TEMPLATE_KEY,
      restaurantId: input.restaurantId,
      bookingId: input.bookingId,
      skipAdminBcc: true,
      ...(input.guestEmail ? { replyTo: input.guestEmail } : {}),
    })

    return send.ok
      ? { ok: true, emailId: send.resendId }
      : { ok: false, error: send.error ?? send.reason }
  } catch (err) {
    console.error('[restaurantNotify:booking_cancelled] unexpected error', err)
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
