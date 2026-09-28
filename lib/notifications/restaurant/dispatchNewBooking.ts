// lib/notifications/restaurant/dispatchNewBooking.ts
//
// Sends the restaurant-facing "new booking" email (D5.6b). Called from
// app/api/consumer/bookings/create/route.ts in its own after() block,
// separate from the guest confirmation dispatcher — a failure here must
// never affect the guest email and vice versa.

import 'server-only'
import { auditLog } from '@/lib/consumer/audit'
import { sendConsumerEmail } from '@/lib/consumer/email/send'
import { resolveRestaurantRecipient } from './resolveRecipient'
import { renderRestaurantNewBooking } from './templates/newBooking'

const TEMPLATE_KEY = 'restaurant.new_booking'
const BASE_URL = 'https://thetafel.nl'

export type SendRestaurantNewBookingEmailInput = {
  restaurantId: string
  bookingId: string
  bookingRef: string
  guestFullName: string
  guestEmail: string
  guestPhone: string | null
  slotTime: Date | string
  partySize: number
  allergies?: string
  occasion?: string
  requests?: string
  guestNote?: string
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

export async function sendRestaurantNewBookingEmail(
  input: SendRestaurantNewBookingEmailInput
): Promise<DispatchResult> {
  try {
    const r = await resolveRestaurantRecipient(input.restaurantId)
    if (!r) {
      console.error('[restaurantNotify:new_booking] restaurant not found', {
        restaurantId: input.restaurantId,
      })
      return { ok: false, error: 'restaurant_not_found' }
    }

    if (!r.toggles.newBooking) {
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

    const rendered = renderRestaurantNewBooking({
      locale: r.locale,
      restaurantName: r.restaurantName,
      guestFullName: input.guestFullName,
      guestEmail: input.guestEmail,
      guestPhone: input.guestPhone,
      slotTime: input.slotTime,
      partySize: input.partySize,
      bookingRef: input.bookingRef,
      allergies: input.allergies,
      occasion: input.occasion,
      requests: input.requests,
      guestNote: input.guestNote,
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
    console.error('[restaurantNotify:new_booking] unexpected error', err)
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
