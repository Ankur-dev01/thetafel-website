import 'server-only'
import { auditLog } from '../audit'
import { renderBookingConfirmation } from '../email/templates/bookingConfirmation'
import { sendConsumerEmail } from '../email/send'
import { isWhatsAppEnabled, sendWhatsAppMessage } from '../whatsapp/send'
import { firstNameOf } from '../email/escape'
import type { EmailLocale } from '../email/layout'
import { buildManageBookingUrl, formatSlotTimeForLocale } from './format'

/**
 * The single entry point every consumer flow uses to send a booking
 * confirmation. Picks channels (email always, WhatsApp when available),
 * fires sends in parallel, audits the dispatch summary, returns a per-
 * channel result.
 *
 * Behaviour:
 *   - Email always attempted. If it fails, the overall result is ok=false.
 *   - WhatsApp attempted only when isWhatsAppEnabled() AND guest provided
 *     a phone number. Failure is non-fatal — overall result stays ok if
 *     email succeeded.
 *   - One 'notification.dispatched' audit row per call summarises the
 *     attempt. Per-channel rows (email.sent / whatsapp.sent) still get
 *     written by the underlying send helpers for low-level tracing.
 *
 * Never throws. All errors caught and returned in the result.
 */

export type BookingConfirmationNotificationInput = {
  locale: EmailLocale

  // ── Guest ────────────────────────────────────────────────────────────
  guestFullName: string
  guestEmail: string
  /** E.164 phone, or null/empty if guest didn't provide one. Required for WhatsApp. */
  guestPhone: string | null

  // ── Restaurant ───────────────────────────────────────────────────────
  restaurantId: string
  restaurantName: string
  restaurantSlug: string
  restaurantPhone: string | null
  restaurantAddress: {
    line1: string
    line2: string
  } | null
  /** D5.6c — single-line address for {adres} substitution in customMessageTemplate. */
  restaurantAddressLine?: string | null
  /** D5.6c — restaurants.confirmation_template_nl/_en for this booking's locale, trimmed, or null. */
  customMessageTemplate?: string | null
  /** D5.6e — restaurants.contact_email, trimmed. Reply-To so a guest hitting Reply reaches the restaurant, not hallo@thetafel.nl. */
  restaurantContactEmail?: string | null

  // ── Booking ──────────────────────────────────────────────────────────
  bookingId: string
  bookingRef: string
  slotTime: Date | string
  partySize: number
  durationMinutes: number
  depositAmountCents: number | null
  depositCurrency: string | null

  // ── Magic link ───────────────────────────────────────────────────────
  /** Plaintext magic-link token. The dispatcher composes the manage URL. */
  magicLinkToken: string

  /** Optional override for the base URL (test / staging only). */
  baseUrl?: string

  /**
   * restaurants.notify_booking_confirmed. False = skip the email
   * silently (counts as success, no email.send_failed row, no
   * Today-page alert). Email-only — does not gate the WhatsApp branch
   * below, which stays governed solely by the global
   * isWhatsAppEnabled() flag (D5.6a scope; WhatsApp isn't live in prod
   * regardless).
   */
  restaurantNotifyBookingConfirmed: boolean
}

export type ChannelResult =
  | { attempted: false }
  | { attempted: true; ok: true; id: string }
  | { attempted: true; ok: false; error: string }

export type DispatchResult = {
  /** Overall success — true if email succeeded (the floor). */
  ok: boolean
  email: ChannelResult
  whatsapp: ChannelResult
}

const NOT_ATTEMPTED: ChannelResult = { attempted: false }

export async function sendBookingConfirmationNotification(
  input: BookingConfirmationNotificationInput
): Promise<DispatchResult> {
  const manageUrl = buildManageBookingUrl({
    slug: input.restaurantSlug,
    magicLinkToken: input.magicLinkToken,
    locale: input.locale,
    baseUrl: input.baseUrl,
  })

  // Pre-format the slot time once for WhatsApp. The email template
  // reformats from the raw Date internally (C3.1).
  const slotTimeString = formatSlotTimeForLocale(input.slotTime, input.locale)

  const emailSkippedByRestaurant = input.restaurantNotifyBookingConfirmed === false

  // Fire both channels in parallel.
  const [emailResult, whatsappResult] = await Promise.all([
    emailSkippedByRestaurant ? Promise.resolve<ChannelResult>(NOT_ATTEMPTED) : dispatchEmail(input, manageUrl),
    isWhatsAppEnabled() && input.guestPhone
      ? dispatchWhatsApp(input, slotTimeString)
      : Promise.resolve<ChannelResult>(NOT_ATTEMPTED),
  ])

  if (emailSkippedByRestaurant) {
    await auditLog({
      restaurantId: input.restaurantId,
      eventType: 'email.skipped',
      eventData: { templateKey: 'booking.confirmation', reason: 'restaurant_disabled' },
      actorType: 'system',
      bookingId: input.bookingId,
    }).catch(() => {})
  }

  const ok = emailSkippedByRestaurant ? true : emailResult.attempted && emailResult.ok

  await auditLog({
    restaurantId: input.restaurantId,
    eventType: 'notification.dispatched',
    eventData: {
      intent: 'booking_confirmation',
      locale: input.locale,
      bookingRef: input.bookingRef,
      email: summariseChannel(emailResult),
      whatsapp: summariseChannel(whatsappResult),
      whatsappEnabled: isWhatsAppEnabled(),
      hadGuestPhone: !!input.guestPhone,
      emailSkippedByRestaurant,
    },
    actorType: 'system',
    bookingId: input.bookingId,
  })

  return { ok, email: emailResult, whatsapp: whatsappResult }
}

// ── Internals ────────────────────────────────────────────────────────────────

async function dispatchEmail(
  input: BookingConfirmationNotificationInput,
  manageUrl: string
): Promise<ChannelResult> {
  try {
    const rendered = renderBookingConfirmation({
      locale: input.locale,
      guestFullName: input.guestFullName,
      guestEmail: input.guestEmail,
      restaurantName: input.restaurantName,
      restaurantSlug: input.restaurantSlug,
      restaurantPhone: input.restaurantPhone,
      restaurantAddress: input.restaurantAddress,
      restaurantAddressLine: input.restaurantAddressLine ?? null,
      customMessageTemplate: input.customMessageTemplate ?? null,
      bookingRef: input.bookingRef,
      slotTime: input.slotTime,
      partySize: input.partySize,
      durationMinutes: input.durationMinutes,
      depositAmountCents: input.depositAmountCents,
      depositCurrency: input.depositCurrency,
      manageUrl,
    })

    const replyTo = input.restaurantContactEmail?.trim() || undefined

    const result = await sendConsumerEmail({
      to: input.guestEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      templateKey: 'booking.confirmation',
      restaurantId: input.restaurantId,
      bookingId: input.bookingId,
      ...(replyTo ? { replyTo } : {}),
    })

    if (result.ok) return { attempted: true, ok: true, id: result.resendId }
    return { attempted: true, ok: false, error: result.error ?? result.reason }
  } catch (err) {
    console.error('[dispatcher] email render/send failed', err)
    return {
      attempted: true,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

async function dispatchWhatsApp(
  input: BookingConfirmationNotificationInput,
  slotTimeString: string
): Promise<ChannelResult> {
  if (!input.guestPhone) return NOT_ATTEMPTED

  try {
    const firstName = firstNameOf(
      input.guestFullName,
      input.locale === 'en' ? 'there' : 'daar'
    )
    const templateKey =
      input.locale === 'en' ? 'booking_confirmation_en' : 'booking_confirmation_nl'

    const result = await sendWhatsAppMessage({
      to: input.guestPhone,
      templateKey,
      bodyParameters: [
        firstName,
        input.restaurantName,
        String(input.partySize),
        slotTimeString,
        input.bookingRef,
      ],
      buttonParameters: [[input.restaurantSlug, input.magicLinkToken]],
      restaurantId: input.restaurantId,
      bookingId: input.bookingId,
    })

    if (result.ok) return { attempted: true, ok: true, id: result.messageId }
    return {
      attempted: true,
      ok: false,
      error: `${result.reason}${result.error ? ': ' + result.error : ''}`,
    }
  } catch (err) {
    console.error('[dispatcher] whatsapp send failed', err)
    return {
      attempted: true,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

function summariseChannel(result: ChannelResult): Record<string, unknown> {
  if (!result.attempted) return { attempted: false }
  if (result.ok) return { attempted: true, ok: true, id: result.id }
  return { attempted: true, ok: false, error: result.error }
}
