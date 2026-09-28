import 'server-only'
import { escapeHtml } from '@/lib/consumer/email/escape'
import { wrapEmailLayout, type EmailLocale } from '@/lib/consumer/email/layout'

/**
 * Restaurant-facing "booking cancelled by guest" email (D5.6b). Sent to
 * restaurants.contact_email when a guest cancels via the manage page.
 * Staff-cancelled bookings do NOT trigger this — see
 * app/api/v1/public/[slug]/book/cancel/route.ts, the only caller.
 */

export type RestaurantBookingCancelledInput = {
  locale: EmailLocale
  restaurantName: string
  guestFullName: string
  slotTime: Date | string
  partySize: number
  bookingRef: string
  refundStatus: 'not_applicable' | 'refunded' | 'refund_failed'
  refundCents: number
  refundCurrency: string
  /** Absolute URL into the dashboard booking-detail panel. */
  bookingUrl: string
  /** Absolute URL into /dashboard/settings/notifications. */
  settingsUrl: string
}

export type RenderedEmail = {
  subject: string
  html: string
  text: string
}

const COPY = {
  nl: {
    subject: (guestName: string, when: string) => `Reservering geannuleerd — ${guestName}, ${when}`,
    heading: (guestName: string) => `Reservering geannuleerd door ${guestName}`,
    whenLabel: 'Was gepland op',
    partyLabel: 'Aantal personen',
    refLabel: 'Referentie',
    refundedLine: (amount: string) => `Aanbetaling van ${amount} is terugbetaald.`,
    refundFailedLine: 'Terugbetaling van de aanbetaling is mislukt — handel dit handmatig af.',
    cta: 'Bekijk reservering',
    footer: (settingsUrl: string) =>
      `Je ontvangt deze e-mail omdat meldingen aan staan in je <a href="${settingsUrl}" style="color:#9c8b6a;text-decoration:underline;">instellingen</a>.`,
    preview: (guestName: string) => `${guestName} heeft geannuleerd`,
  },
  en: {
    subject: (guestName: string, when: string) => `Booking cancelled — ${guestName}, ${when}`,
    heading: (guestName: string) => `Booking cancelled by ${guestName}`,
    whenLabel: 'Was scheduled for',
    partyLabel: 'Party size',
    refLabel: 'Reference',
    refundedLine: (amount: string) => `Deposit of ${amount} was refunded.`,
    refundFailedLine: 'Deposit refund failed — please handle it manually.',
    cta: 'View booking',
    footer: (settingsUrl: string) =>
      `You're receiving this because notifications are on in your <a href="${settingsUrl}" style="color:#9c8b6a;text-decoration:underline;">settings</a>.`,
    preview: (guestName: string) => `${guestName} cancelled`,
  },
} as const

function formatSlot(slot: Date | string, locale: EmailLocale): string {
  const d = typeof slot === 'string' ? new Date(slot) : slot
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'nl-NL', {
    timeZone: 'Europe/Amsterdam',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

function formatMoney(cents: number, currency: string, locale: EmailLocale): string {
  return new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'nl-NL', {
    style: 'currency',
    currency: currency || 'EUR',
    minimumFractionDigits: 2,
  }).format(cents / 100)
}

export function renderRestaurantBookingCancelled(
  input: RestaurantBookingCancelledInput
): RenderedEmail {
  const c = COPY[input.locale]
  const slotStr = formatSlot(input.slotTime, input.locale)

  const rows: Array<[string, string]> = [
    [c.whenLabel, slotStr],
    [c.partyLabel, String(input.partySize)],
    [c.refLabel, input.bookingRef],
  ]

  let refundLine: string | null = null
  if (input.refundStatus === 'refunded' && input.refundCents > 0) {
    refundLine = c.refundedLine(formatMoney(input.refundCents, input.refundCurrency, input.locale))
  } else if (input.refundStatus === 'refund_failed') {
    refundLine = c.refundFailedLine
  }

  const bodyHtml = [
    `<h2 style="margin:0 0 20px;font-size:19px;color:#0f0d08;">${escapeHtml(c.heading(input.guestFullName))}</h2>`,
    '',
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f8f2e6;padding:18px 20px;margin:0 0 22px;">',
    rows
      .map(
        ([k, v]) => `
    <tr>
      <td style="padding:6px 0;font-size:13px;color:#9c8b6a;width:140px;">${escapeHtml(k)}</td>
      <td style="padding:6px 0;font-size:14px;color:#0f0d08;font-weight:500;">${escapeHtml(v)}</td>
    </tr>`
      )
      .join(''),
    '</table>',
    refundLine
      ? `<p style="margin:0 0 22px;font-size:14px;line-height:1.5;color:#0f0d08;">${escapeHtml(refundLine)}</p>`
      : '',
    '<div style="margin-top:8px;text-align:center;">',
    `  <a href="${escapeHtml(input.bookingUrl)}" style="display:inline-block;padding:14px 28px;background:#d4820a;color:#fdfaf5;font-size:14px;font-weight:600;letter-spacing:0.02em;text-decoration:none;border-radius:999px;">`,
    `    ${escapeHtml(c.cta)}`,
    '  </a>',
    '</div>',
    '',
    `<p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#9c8b6a;text-align:center;">${c.footer(escapeHtml(input.settingsUrl))}</p>`,
  ].join('\n')

  const html = wrapEmailLayout({
    bodyHtml,
    preheader: c.preview(input.guestFullName),
    restaurantName: input.restaurantName,
    locale: input.locale,
  })

  const text = [
    c.heading(input.guestFullName),
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    ...(refundLine ? ['', refundLine] : []),
    '',
    `${c.cta}: ${input.bookingUrl}`,
  ].join('\n')

  return {
    subject: c.subject(input.guestFullName, slotStr),
    html,
    text,
  }
}
