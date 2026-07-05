// lib/consumer/notifications/dispatchCancellation.ts
//
// Cancellation dispatcher - mirrors sendBookingConfirmationNotification but
// for the cancel event. Email always; WhatsApp is deferred until Meta
// approves the deposit_refunded / booking_cancelled templates (feature-
// flagged off in C3.2). No WhatsApp send here - email only.

import 'server-only'
import { auditLog } from '../audit'
import { renderBookingCancellation } from '../email/templates/bookingCancellation'
import { sendConsumerEmail } from '../email/send'
import type { EmailLocale } from '../email/layout'

export type BookingCancellationNotificationInput = {
  locale: EmailLocale
  guestFullName: string
  guestEmail: string
  guestPhone: string | null
  restaurantId: string
  restaurantName: string
  restaurantSlug: string
  bookingId: string
  bookingRef: string
  slotTime: Date | string
  partySize: number
  refundStatus: 'not_applicable' | 'refunded' | 'refund_failed'
  refundCents: number
  refundCurrency: string
}

export type DispatchResult = {
  ok: boolean
  emailId?: string
  error?: string
}

export async function sendBookingCancellationNotification(
  input: BookingCancellationNotificationInput
): Promise<DispatchResult> {
  let result: DispatchResult
  try {
    const rendered = renderBookingCancellation({
      locale: input.locale,
      guestFullName: input.guestFullName,
      restaurantName: input.restaurantName,
      restaurantSlug: input.restaurantSlug,
      bookingRef: input.bookingRef,
      slotTime: input.slotTime,
      partySize: input.partySize,
      refundStatus: input.refundStatus,
      refundCents: input.refundCents,
      refundCurrency: input.refundCurrency,
    })

    const send = await sendConsumerEmail({
      to: input.guestEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      templateKey: 'booking.cancellation',
      restaurantId: input.restaurantId,
      bookingId: input.bookingId,
    })

    if (send.ok) {
      result = { ok: true, emailId: send.resendId }
    } else {
      result = { ok: false, error: send.error ?? send.reason }
    }
  } catch (err) {
    console.error('[dispatchCancellation] failed', err)
    result = {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }

  await auditLog({
    restaurantId: input.restaurantId,
    eventType: 'notification.dispatched',
    eventData: {
      intent: 'booking_cancellation',
      locale: input.locale,
      bookingRef: input.bookingRef,
      refundStatus: input.refundStatus,
      email: {
        ok: result.ok,
        id: result.emailId ?? null,
        error: result.error ?? null,
      },
    },
    actorType: 'system',
    bookingId: input.bookingId,
  }).catch(() => {})

  return result
}
