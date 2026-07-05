import 'server-only'
import { escapeHtml, firstNameOf } from '../escape'
import { wrapEmailLayout, type EmailLocale } from '../layout'

/**
 * Cancellation confirmation email sent to the guest after they cancel via
 * the manage page. Bilingual (nl / en). Includes refund status and the
 * Mollie ~3-5 business day settlement window when applicable.
 */

export type BookingCancellationInput = {
  locale: EmailLocale
  guestFullName: string
  restaurantName: string
  restaurantSlug: string
  bookingRef: string
  slotTime: Date | string
  partySize: number
  refundStatus: 'not_applicable' | 'refunded' | 'refund_failed'
  refundCents: number
  refundCurrency: string
}

export type RenderedEmail = {
  subject: string
  html: string
  text: string
}

const COPY = {
  nl: {
    subject: (r: string) => `Je reservering bij ${r} is geannuleerd`,
    greeting: (n: string) => `Hi ${n},`,
    intro: 'Je reservering is geannuleerd. Hieronder de details:',
    refLabel: 'Referentie',
    whenLabel: 'Datum en tijd',
    partyLabel: 'Aantal personen',
    refundHeadingRefunded: 'Terugbetaling',
    refundHeadingFailed: 'Terugbetaling niet gelukt',
    refundHeadingNone: 'Geen aanbetaling',
    refundLineRefunded: (a: string) =>
      `We hebben ${a} teruggeboekt naar dezelfde betaalmethode. Dit duurt meestal 3 tot 5 werkdagen.`,
    refundLineFailed:
      'Er ging iets mis met de terugbetaling. We hebben dit gezien en nemen zo snel mogelijk contact op om het handmatig te verwerken.',
    refundLineNone: 'Er was geen aanbetaling voor deze reservering.',
    closingLine: 'Hopelijk tot een andere keer.',
    preview: (ref: string) => `Reservering ${ref} geannuleerd`,
  },
  en: {
    subject: (r: string) => `Your booking at ${r} is cancelled`,
    greeting: (n: string) => `Hi ${n},`,
    intro: 'Your booking has been cancelled. Here are the details:',
    refLabel: 'Reference',
    whenLabel: 'Date and time',
    partyLabel: 'Party size',
    refundHeadingRefunded: 'Refund',
    refundHeadingFailed: 'Refund could not be processed',
    refundHeadingNone: 'No deposit',
    refundLineRefunded: (a: string) =>
      `We've refunded ${a} to the same payment method. This usually takes 3 to 5 business days.`,
    refundLineFailed:
      "Something went wrong with the refund. We've been notified and will contact you shortly to process it manually.",
    refundLineNone: 'There was no deposit on this booking.',
    closingLine: 'We hope to see you another time.',
    preview: (ref: string) => `Booking ${ref} cancelled`,
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

export function renderBookingCancellation(input: BookingCancellationInput): RenderedEmail {
  const c = COPY[input.locale]
  const slotStr = formatSlot(input.slotTime, input.locale)
  const firstName = firstNameOf(input.guestFullName, input.locale === 'en' ? 'there' : 'daar')

  let refundHeading: string
  let refundLine: string
  if (input.refundStatus === 'refunded' && input.refundCents > 0) {
    const amount = formatMoney(input.refundCents, input.refundCurrency, input.locale)
    refundHeading = c.refundHeadingRefunded
    refundLine = c.refundLineRefunded(amount)
  } else if (input.refundStatus === 'refund_failed') {
    refundHeading = c.refundHeadingFailed
    refundLine = c.refundLineFailed
  } else {
    refundHeading = c.refundHeadingNone
    refundLine = c.refundLineNone
  }

  const rows: Array<[string, string]> = [
    [c.refLabel, input.bookingRef],
    [c.whenLabel, slotStr],
    [c.partyLabel, String(input.partySize)],
  ]

  const bodyHtml = [
    `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#0f0d08;">${escapeHtml(c.greeting(firstName))}</p>`,
    `<p style="margin:0 0 22px;font-size:15px;line-height:1.55;color:#0f0d08;">${escapeHtml(c.intro)}</p>`,
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
    '',
    `<h3 style="font-size:18px;color:#0f0d08;margin:32px 0 8px;">${escapeHtml(refundHeading)}</h3>`,
    `<p style="font-size:15px;color:#0f0d08;line-height:1.5;margin:0 0 24px;">${escapeHtml(refundLine)}</p>`,
    `<p style="font-size:15px;color:#0f0d08;line-height:1.5;margin:0;">${escapeHtml(c.closingLine)}</p>`,
  ].join('\n')

  const html = wrapEmailLayout({
    bodyHtml,
    preheader: c.preview(input.bookingRef),
    restaurantName: input.restaurantName,
    locale: input.locale,
  })

  const text = [
    c.greeting(firstName),
    '',
    c.intro,
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    '',
    refundHeading,
    refundLine,
    '',
    c.closingLine,
  ].join('\n')

  return {
    subject: c.subject(input.restaurantName),
    html,
    text,
  }
}
