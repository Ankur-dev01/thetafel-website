import 'server-only'
import { escapeHtml, firstNameOf } from '../escape'
import { wrapEmailLayout, type EmailLocale } from '../layout'

/**
 * Booking confirmation email — sent immediately after a guest creates a
 * booking via the consumer-facing form (C4).
 */

export type BookingConfirmationInput = {
  locale: EmailLocale
  guestFullName: string
  guestEmail: string
  restaurantName: string
  restaurantSlug: string
  restaurantPhone: string | null
  restaurantAddress: {
    line1: string
    line2: string
  } | null
  bookingRef: string
  slotTime: Date | string
  partySize: number
  durationMinutes: number
  depositAmountCents: number | null
  depositCurrency: string | null
  /** Full URL including the magic-link token. */
  manageUrl: string
}

export type RenderedEmail = {
  subject: string
  preheader: string
  html: string
  text: string
}

const COPY = {
  nl: {
    subjectTemplate: (r: string) => `Je reservering bij ${r} is bevestigd`,
    greeting: (n: string) => `Hi ${n},`,
    intro: 'Bedankt voor je reservering. Hieronder de details:',
    partyLabel: 'Aantal personen',
    whenLabel: 'Datum en tijd',
    durationLabel: 'Duur',
    durationSuffix: (m: number) => `${m} minuten`,
    refLabel: 'Referentie',
    depositLabel: 'Aanbetaling',
    depositPaid: 'Voldaan',
    whereLabel: 'Adres',
    phoneLabel: 'Telefoon',
    manageCta: 'Reservering wijzigen of annuleren',
    noteLine:
      'Bewaar deze e-mail. De link werkt 14 dagen en geeft toegang tot je reservering.',
    preheader: (party: number, when: string) =>
      `${party} ${party === 1 ? 'persoon' : 'personen'} op ${when}`,
  },
  en: {
    subjectTemplate: (r: string) => `Your booking at ${r} is confirmed`,
    greeting: (n: string) => `Hi ${n},`,
    intro: 'Thanks for booking with us. Here are your details:',
    partyLabel: 'Party size',
    whenLabel: 'Date and time',
    durationLabel: 'Duration',
    durationSuffix: (m: number) => `${m} minutes`,
    refLabel: 'Reference',
    depositLabel: 'Deposit',
    depositPaid: 'Paid',
    whereLabel: 'Address',
    phoneLabel: 'Phone',
    manageCta: 'Modify or cancel booking',
    noteLine:
      'Keep this email. The link is valid for 14 days and gives you access to your booking.',
    preheader: (party: number, when: string) =>
      `${party} ${party === 1 ? 'guest' : 'guests'} on ${when}`,
  },
} as const

function formatSlotTime(slot: Date | string, locale: EmailLocale): string {
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
  return `${datePart}, ${timePart}`
}

function formatMoney(cents: number, currency: string, locale: EmailLocale): string {
  const fmtLocale = locale === 'en' ? 'en-GB' : 'nl-NL'
  return new Intl.NumberFormat(fmtLocale, {
    style: 'currency',
    currency: currency || 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

export function renderBookingConfirmation(
  input: BookingConfirmationInput
): RenderedEmail {
  const t = COPY[input.locale]
  const firstName = firstNameOf(input.guestFullName, input.locale === 'en' ? 'there' : 'daar')
  const when = formatSlotTime(input.slotTime, input.locale)

  const subject = t.subjectTemplate(input.restaurantName)
  const preheader = t.preheader(input.partySize, when)

  // ── HTML body ────────────────────────────────────────────────────────────

  const depositRow =
    input.depositAmountCents && input.depositAmountCents > 0
      ? [
          '<tr>',
          `  <td style="padding:6px 0;font-size:13px;color:#9c8b6a;width:140px;">${t.depositLabel}</td>`,
          `  <td style="padding:6px 0;font-size:14px;color:#0f0d08;">`,
          `    ${formatMoney(input.depositAmountCents, input.depositCurrency || 'EUR', input.locale)}`,
          `    <span style="color:#9c8b6a;font-size:12px;">&middot; ${t.depositPaid}</span>`,
          '  </td>',
          '</tr>',
        ].join('\n')
      : ''

  const addressBlock = input.restaurantAddress
    ? [
        `<div style="margin-top:16px;font-size:13px;color:#9c8b6a;">${t.whereLabel}</div>`,
        '<div style="font-size:14px;color:#0f0d08;line-height:1.5;margin-top:4px;">',
        `  ${escapeHtml(input.restaurantAddress.line1)}<br />`,
        `  ${escapeHtml(input.restaurantAddress.line2)}`,
        '</div>',
      ].join('\n')
    : ''

  const phoneBlock = input.restaurantPhone
    ? [
        `<div style="margin-top:14px;font-size:13px;color:#9c8b6a;">${t.phoneLabel}</div>`,
        '<div style="font-size:14px;margin-top:4px;">',
        `  <a href="tel:${escapeHtml(input.restaurantPhone.replace(/[^\d+]/g, ''))}" style="color:#d4820a;text-decoration:none;">${escapeHtml(input.restaurantPhone)}</a>`,
        '</div>',
      ].join('\n')
    : ''

  const bodyHtml = [
    `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#0f0d08;">${escapeHtml(t.greeting(firstName))}</p>`,
    `<p style="margin:0 0 22px;font-size:15px;line-height:1.55;color:#0f0d08;">${escapeHtml(t.intro)}</p>`,
    '',
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f8f2e6;padding:18px 20px;margin:0 0 22px;">',
    '  <tr>',
    `    <td style="padding:6px 0;font-size:13px;color:#9c8b6a;width:140px;">${t.partyLabel}</td>`,
    `    <td style="padding:6px 0;font-size:14px;color:#0f0d08;">${input.partySize}</td>`,
    '  </tr>',
    '  <tr>',
    `    <td style="padding:6px 0;font-size:13px;color:#9c8b6a;">${t.whenLabel}</td>`,
    `    <td style="padding:6px 0;font-size:14px;color:#0f0d08;">${escapeHtml(when)}</td>`,
    '  </tr>',
    '  <tr>',
    `    <td style="padding:6px 0;font-size:13px;color:#9c8b6a;">${t.durationLabel}</td>`,
    `    <td style="padding:6px 0;font-size:14px;color:#0f0d08;">${t.durationSuffix(input.durationMinutes)}</td>`,
    '  </tr>',
    '  <tr>',
    `    <td style="padding:6px 0;font-size:13px;color:#9c8b6a;">${t.refLabel}</td>`,
    `    <td style="padding:6px 0;font-size:13px;color:#0f0d08;font-family:'SFMono-Regular',Consolas,monospace;">${escapeHtml(input.bookingRef)}</td>`,
    '  </tr>',
    depositRow,
    '</table>',
    '',
    addressBlock,
    phoneBlock,
    '',
    '<div style="margin-top:28px;text-align:center;">',
    `  <a href="${escapeHtml(input.manageUrl)}" style="display:inline-block;padding:14px 28px;background:#0f0d08;color:#fdfaf5;font-size:14px;font-weight:600;letter-spacing:0.02em;text-decoration:none;border-radius:999px;">`,
    `    ${escapeHtml(t.manageCta)}`,
    '  </a>',
    '</div>',
    '',
    `<p style="margin:22px 0 0;font-size:12px;line-height:1.5;color:#9c8b6a;text-align:center;">${escapeHtml(t.noteLine)}</p>`,
  ].join('\n')

  const html = wrapEmailLayout({
    bodyHtml,
    preheader,
    restaurantName: input.restaurantName,
    locale: input.locale,
  })

  // ── Plain-text body ──────────────────────────────────────────────────────
  const textLines: string[] = []
  textLines.push(t.greeting(firstName))
  textLines.push('')
  textLines.push(t.intro)
  textLines.push('')
  textLines.push(`${t.partyLabel}: ${input.partySize}`)
  textLines.push(`${t.whenLabel}: ${when}`)
  textLines.push(`${t.durationLabel}: ${t.durationSuffix(input.durationMinutes)}`)
  textLines.push(`${t.refLabel}: ${input.bookingRef}`)
  if (input.depositAmountCents && input.depositAmountCents > 0) {
    textLines.push(
      `${t.depositLabel}: ${formatMoney(input.depositAmountCents, input.depositCurrency || 'EUR', input.locale)} (${t.depositPaid})`
    )
  }
  if (input.restaurantAddress) {
    textLines.push('')
    textLines.push(
      `${t.whereLabel}: ${input.restaurantAddress.line1}, ${input.restaurantAddress.line2}`
    )
  }
  if (input.restaurantPhone) {
    textLines.push(`${t.phoneLabel}: ${input.restaurantPhone}`)
  }
  textLines.push('')
  textLines.push(`${t.manageCta}: ${input.manageUrl}`)
  textLines.push('')
  textLines.push(t.noteLine)
  textLines.push('')
  textLines.push('—')
  textLines.push('The Tafel · thetafel.nl')

  return {
    subject,
    preheader,
    html,
    text: textLines.join('\n'),
  }
}
