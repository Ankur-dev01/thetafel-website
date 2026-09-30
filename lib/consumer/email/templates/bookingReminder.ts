import 'server-only'
import { escapeHtml, firstNameOf } from '../escape'
import { wrapEmailLayout, type EmailLocale } from '../layout'
import { formatConfirmationDate, formatConfirmationTime, formatGuestCount } from '@/lib/booking/confirmationTemplate'

/**
 * Guest booking reminder email — D5.6d. Two variants (`kind`), sent by the
 * pg_cron-triggered /api/cron/booking-reminders endpoint at T-24h and T-2h.
 * Same layout/styling conventions as bookingConfirmation.ts, deliberately
 * NOT reusing the restaurant's custom confirmation-message template (that's
 * confirmation-email-only, per D5.6c).
 */

export type BookingReminderInput = {
  locale: EmailLocale
  kind: '24h' | '2h'
  guestFullName: string
  restaurantName: string
  slotTime: Date | string
  partySize: number
  bookingRef: string
  restaurantAddressLine: string | null
  restaurantPhone: string | null
  /** Full URL including a freshly-issued manage-booking magic-link token. */
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
    subject24h: (r: string, date: string, time: string) =>
      `Herinnering: je reservering bij ${r} op ${date} om ${time}`,
    subject2h: (r: string, time: string) => `Tot straks bij ${r} — vandaag om ${time}`,
    greeting: (n: string) => `Hi ${n},`,
    intro24h: 'Een korte herinnering aan je reservering.',
    intro2h: 'We zien je straks!',
    whenLabel: 'Datum en tijd',
    partyLabel: 'Aantal personen',
    refLabel: 'Referentie',
    whereLabel: 'Adres',
    phoneLabel: 'Telefoon',
    manageCta: 'Reservering wijzigen of annuleren',
    noteLine: 'Kun je toch niet komen? Laat het ons even weten via de knop hierboven.',
    preheader24h: (when: string) => `Herinnering — ${when}`,
    preheader2h: (time: string) => `Vandaag om ${time}`,
  },
  en: {
    subject24h: (r: string, date: string, time: string) =>
      `Reminder: your booking at ${r} on ${date} at ${time}`,
    subject2h: (r: string, time: string) => `See you soon at ${r} — today at ${time}`,
    greeting: (n: string) => `Hi ${n},`,
    intro24h: 'A quick reminder about your booking.',
    intro2h: "We'll see you soon!",
    whenLabel: 'Date and time',
    partyLabel: 'Party size',
    refLabel: 'Reference',
    whereLabel: 'Address',
    phoneLabel: 'Phone',
    manageCta: 'Change or cancel booking',
    noteLine: "Can't make it after all? Please let us know using the button above.",
    preheader24h: (when: string) => `Reminder — ${when}`,
    preheader2h: (time: string) => `Today at ${time}`,
  },
} as const

export function renderBookingReminder(input: BookingReminderInput): RenderedEmail {
  const t = COPY[input.locale]
  const firstName = firstNameOf(input.guestFullName, input.locale === 'en' ? 'there' : 'daar')
  const date = formatConfirmationDate(input.slotTime, input.locale)
  const time = formatConfirmationTime(input.slotTime, input.locale)
  const when = `${date}, ${time}`
  const guestCount = formatGuestCount(input.partySize, input.locale)

  const subject =
    input.kind === '24h' ? t.subject24h(input.restaurantName, date, time) : t.subject2h(input.restaurantName, time)
  const preheader = input.kind === '24h' ? t.preheader24h(when) : t.preheader2h(time)
  const intro = input.kind === '24h' ? t.intro24h : t.intro2h

  const addressBlock = input.restaurantAddressLine
    ? [
        `<div style="margin-top:16px;font-size:13px;color:#9c8b6a;">${t.whereLabel}</div>`,
        '<div style="font-size:14px;color:#0f0d08;line-height:1.5;margin-top:4px;">',
        `  ${escapeHtml(input.restaurantAddressLine)}`,
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
    `<p style="margin:0 0 22px;font-size:15px;line-height:1.55;color:#0f0d08;">${escapeHtml(intro)}</p>`,
    '',
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f8f2e6;padding:18px 20px;margin:0 0 22px;">',
    '  <tr>',
    `    <td style="padding:6px 0;font-size:13px;color:#9c8b6a;width:140px;">${t.whenLabel}</td>`,
    `    <td style="padding:6px 0;font-size:14px;color:#0f0d08;">${escapeHtml(when)}</td>`,
    '  </tr>',
    '  <tr>',
    `    <td style="padding:6px 0;font-size:13px;color:#9c8b6a;">${t.partyLabel}</td>`,
    `    <td style="padding:6px 0;font-size:14px;color:#0f0d08;">${escapeHtml(guestCount)}</td>`,
    '  </tr>',
    '  <tr>',
    `    <td style="padding:6px 0;font-size:13px;color:#9c8b6a;">${t.refLabel}</td>`,
    `    <td style="padding:6px 0;font-size:13px;color:#0f0d08;font-family:'SFMono-Regular',Consolas,monospace;">${escapeHtml(input.bookingRef)}</td>`,
    '  </tr>',
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

  const textLines: string[] = [
    t.greeting(firstName),
    '',
    intro,
    '',
    `${t.whenLabel}: ${when}`,
    `${t.partyLabel}: ${guestCount}`,
    `${t.refLabel}: ${input.bookingRef}`,
  ]
  if (input.restaurantAddressLine) {
    textLines.push('')
    textLines.push(`${t.whereLabel}: ${input.restaurantAddressLine}`)
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
