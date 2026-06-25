import 'server-only'
import type { EmailLocale } from '../email/layout'

/**
 * Format a booking slot_time into a localised, human-readable string for
 * use in WhatsApp template parameters and SMS-like channels where we
 * can't do anything fancy with structured layouts.
 *
 * NL example: "zaterdag 27 juni 2026 om 19:00"
 * EN example: "Saturday 27 June 2026 at 19:00"
 *
 * Always renders in Europe/Amsterdam timezone regardless of the server's
 * timezone, since restaurant operating hours are NL local.
 */
export function formatSlotTimeForLocale(
  slot: Date | string,
  locale: EmailLocale
): string {
  const date = typeof slot === 'string' ? new Date(slot) : slot
  const fmtLocale = locale === 'en' ? 'en-GB' : 'nl-NL'

  const datePart = new Intl.DateTimeFormat(fmtLocale, {
    timeZone: 'Europe/Amsterdam',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)

  const timePart = new Intl.DateTimeFormat(fmtLocale, {
    timeZone: 'Europe/Amsterdam',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)

  const connector = locale === 'en' ? 'at' : 'om'
  return `${datePart} ${connector} ${timePart}`
}

/**
 * Build the consumer-facing manage URL for a booking.
 *
 * Always points to thetafel.nl (production) so the URL works in real
 * emails and WhatsApp messages that may be opened on the guest's phone.
 * Localised at the path level: '/r/...' for NL, '/en/r/...' for EN.
 */
export function buildManageBookingUrl(args: {
  slug: string
  magicLinkToken: string
  locale: EmailLocale
  baseUrl?: string
}): string {
  const base = (args.baseUrl ?? 'https://thetafel.nl').replace(/\/+$/, '')
  const localePrefix = args.locale === 'en' ? '/en' : ''
  return `${base}${localePrefix}/r/${args.slug}/bookings/manage?t=${args.magicLinkToken}`
}
