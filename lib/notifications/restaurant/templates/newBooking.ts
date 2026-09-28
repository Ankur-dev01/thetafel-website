import 'server-only'
import { escapeHtml, firstNameOf } from '@/lib/consumer/email/escape'
import { wrapEmailLayout, type EmailLocale } from '@/lib/consumer/email/layout'

/**
 * Restaurant-facing "new booking" email (D5.6b). Sent to
 * restaurants.contact_email when a guest books online — mirrors the guest
 * confirmation email's render shape but content and tone are for staff,
 * not the guest.
 */

export type RestaurantNewBookingInput = {
  locale: EmailLocale
  restaurantName: string
  guestFullName: string
  guestEmail: string
  guestPhone: string | null
  slotTime: Date | string
  partySize: number
  bookingRef: string
  /** Optional booking-form free-text fields — only rendered when non-empty. */
  allergies?: string
  occasion?: string
  requests?: string
  guestNote?: string
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
    subject: (guestName: string, partySize: number, when: string) =>
      `Nieuwe reservering — ${guestName}, ${partySize} ${partySize === 1 ? 'pers.' : 'pers.'}, ${when}`,
    heading: (guestName: string) => `Nieuwe reservering van ${guestName}`,
    whenLabel: 'Datum en tijd',
    partyLabel: 'Aantal personen',
    phoneLabel: 'Telefoon',
    emailLabel: 'E-mail',
    refLabel: 'Referentie',
    allergiesLabel: 'Allergieën',
    occasionLabel: 'Gelegenheid',
    requestsLabel: 'Wensen',
    noteLabel: 'Notitie',
    cta: 'Bekijk reservering',
    footer: (settingsUrl: string) =>
      `Je ontvangt deze e-mail omdat meldingen aan staan in je <a href="${settingsUrl}" style="color:#9c8b6a;text-decoration:underline;">instellingen</a>.`,
    preview: (guestName: string, partySize: number) =>
      `${guestName} · ${partySize} ${partySize === 1 ? 'persoon' : 'personen'}`,
  },
  en: {
    subject: (guestName: string, partySize: number, when: string) =>
      `New booking — ${guestName}, ${partySize} ${partySize === 1 ? 'guest' : 'guests'}, ${when}`,
    heading: (guestName: string) => `New booking from ${guestName}`,
    whenLabel: 'Date and time',
    partyLabel: 'Party size',
    phoneLabel: 'Phone',
    emailLabel: 'Email',
    refLabel: 'Reference',
    allergiesLabel: 'Allergies',
    occasionLabel: 'Occasion',
    requestsLabel: 'Requests',
    noteLabel: 'Note',
    cta: 'View booking',
    footer: (settingsUrl: string) =>
      `You're receiving this because notifications are on in your <a href="${settingsUrl}" style="color:#9c8b6a;text-decoration:underline;">settings</a>.`,
    preview: (guestName: string, partySize: number) =>
      `${guestName} · ${partySize} ${partySize === 1 ? 'guest' : 'guests'}`,
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

export function renderRestaurantNewBooking(input: RestaurantNewBookingInput): RenderedEmail {
  const c = COPY[input.locale]
  const slotStr = formatSlot(input.slotTime, input.locale)
  const guestName = input.guestFullName || firstNameOf('', input.locale === 'en' ? 'Guest' : 'Gast')

  const rows: Array<[string, string]> = [
    [c.whenLabel, slotStr],
    [c.partyLabel, String(input.partySize)],
  ]
  if (input.guestPhone) rows.push([c.phoneLabel, input.guestPhone])
  rows.push([c.emailLabel, input.guestEmail])
  rows.push([c.refLabel, input.bookingRef])

  const noteRows: Array<[string, string]> = []
  if (input.allergies?.trim()) noteRows.push([c.allergiesLabel, input.allergies.trim()])
  if (input.occasion?.trim()) noteRows.push([c.occasionLabel, input.occasion.trim()])
  if (input.requests?.trim()) noteRows.push([c.requestsLabel, input.requests.trim()])
  if (input.guestNote?.trim()) noteRows.push([c.noteLabel, input.guestNote.trim()])

  const bodyHtml = [
    `<h2 style="margin:0 0 20px;font-size:19px;color:#0f0d08;">${escapeHtml(c.heading(guestName))}</h2>`,
    '',
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f8f2e6;padding:18px 20px;margin:0 0 22px;">',
    rows
      .map(
        ([k, v]) => `
    <tr>
      <td style="padding:6px 0;font-size:13px;color:#9c8b6a;width:140px;vertical-align:top;">${escapeHtml(k)}</td>
      <td style="padding:6px 0;font-size:14px;color:#0f0d08;font-weight:500;">${escapeHtml(v)}</td>
    </tr>`
      )
      .join(''),
    '</table>',
    noteRows.length > 0
      ? [
          '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 22px;">',
          noteRows
            .map(
              ([k, v]) => `
    <tr>
      <td style="padding:4px 0;font-size:13px;color:#9c8b6a;width:140px;vertical-align:top;">${escapeHtml(k)}</td>
      <td style="padding:4px 0;font-size:14px;color:#0f0d08;">${escapeHtml(v)}</td>
    </tr>`
            )
            .join(''),
          '</table>',
        ].join('\n')
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
    preheader: c.preview(guestName, input.partySize),
    restaurantName: input.restaurantName,
    locale: input.locale,
  })

  const text = [
    c.heading(guestName),
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    ...(noteRows.length > 0 ? ['', ...noteRows.map(([k, v]) => `${k}: ${v}`)] : []),
    '',
    `${c.cta}: ${input.bookingUrl}`,
  ].join('\n')

  return {
    subject: c.subject(guestName, input.partySize, slotStr),
    html,
    text,
  }
}
