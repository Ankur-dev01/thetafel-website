import 'server-only'
import { escapeHtml } from '@/lib/consumer/email/escape'
import { wrapEmailLayout, type EmailLocale } from '@/lib/consumer/email/layout'

/**
 * Restaurant-facing "new takeaway order" email (D5.6b). Sent to
 * restaurants.contact_email once a takeaway order's payment is confirmed.
 */

export type RestaurantNewOrderInput = {
  locale: EmailLocale
  restaurantName: string
  orderRef: string
  pickupTime: Date | string
  items: Array<{ name: string; quantity: number; lineTotalCents: number }>
  totalCents: number
  currency: string
  guestFullName: string
  guestPhone: string | null
  /** Absolute URL into the dashboard order-detail panel. */
  orderUrl: string
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
    subject: (orderRef: string, time: string) => `Nieuwe afhaalbestelling ${orderRef} — ophalen ${time}`,
    heading: (orderRef: string) => `Nieuwe afhaalbestelling ${orderRef}`,
    pickupLabel: 'Afhaaltijd',
    guestLabel: 'Naam',
    phoneLabel: 'Telefoon',
    itemsLabel: 'Bestelling',
    totalLabel: 'Totaal',
    cta: 'Bekijk bestelling',
    footer: (settingsUrl: string) =>
      `Je ontvangt deze e-mail omdat meldingen aan staan in je <a href="${settingsUrl}" style="color:#9c8b6a;text-decoration:underline;">instellingen</a>.`,
    preview: (time: string) => `Ophalen om ${time}`,
  },
  en: {
    subject: (orderRef: string, time: string) => `New takeaway order ${orderRef} — pickup ${time}`,
    heading: (orderRef: string) => `New takeaway order ${orderRef}`,
    pickupLabel: 'Pickup time',
    guestLabel: 'Name',
    phoneLabel: 'Phone',
    itemsLabel: 'Order',
    totalLabel: 'Total',
    cta: 'View order',
    footer: (settingsUrl: string) =>
      `You're receiving this because notifications are on in your <a href="${settingsUrl}" style="color:#9c8b6a;text-decoration:underline;">settings</a>.`,
    preview: (time: string) => `Pickup at ${time}`,
  },
} as const

function formatPickupTime(slot: Date | string, locale: EmailLocale): string {
  const date = typeof slot === 'string' ? new Date(slot) : slot
  const fmtLocale = locale === 'en' ? 'en-GB' : 'nl-NL'
  const datePart = new Intl.DateTimeFormat(fmtLocale, {
    timeZone: 'Europe/Amsterdam',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date)
  const timePart = new Intl.DateTimeFormat(fmtLocale, {
    timeZone: 'Europe/Amsterdam',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
  return `${datePart}, ${timePart}`
}

function formatPickupTimeOnly(slot: Date | string, locale: EmailLocale): string {
  const date = typeof slot === 'string' ? new Date(slot) : slot
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'nl-NL', {
    timeZone: 'Europe/Amsterdam',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function formatMoney(cents: number, currency: string, locale: EmailLocale): string {
  return new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'nl-NL', {
    style: 'currency',
    currency: currency || 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

export function renderRestaurantNewOrder(input: RestaurantNewOrderInput): RenderedEmail {
  const c = COPY[input.locale]
  const whenFull = formatPickupTime(input.pickupTime, input.locale)
  const whenTimeOnly = formatPickupTimeOnly(input.pickupTime, input.locale)

  const rows: Array<[string, string]> = [
    [c.pickupLabel, whenFull],
    [c.guestLabel, input.guestFullName],
  ]
  if (input.guestPhone) rows.push([c.phoneLabel, input.guestPhone])

  const itemRows = input.items
    .map(
      (item) => `
  <tr>
    <td style="padding:6px 0;font-size:14px;color:#0f0d08;">${item.quantity}&times; ${escapeHtml(item.name)}</td>
    <td style="padding:6px 0;font-size:14px;color:#0f0d08;text-align:right;">${formatMoney(item.lineTotalCents, input.currency, input.locale)}</td>
  </tr>`
    )
    .join('')

  const bodyHtml = [
    `<h2 style="margin:0 0 20px;font-size:19px;color:#0f0d08;">${escapeHtml(c.heading(input.orderRef))}</h2>`,
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
    `<div style="margin:0 0 8px;font-size:13px;color:#9c8b6a;">${c.itemsLabel}</div>`,
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 8px;">',
    itemRows,
    '</table>',
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px solid #f0e8d8;margin-top:8px;">',
    '  <tr>',
    `    <td style="padding:10px 0 0;font-size:14px;font-weight:700;color:#0f0d08;">${c.totalLabel}</td>`,
    `    <td style="padding:10px 0 0;font-size:14px;font-weight:700;color:#0f0d08;text-align:right;">${formatMoney(input.totalCents, input.currency, input.locale)}</td>`,
    '  </tr>',
    '</table>',
    '',
    '<div style="margin-top:28px;text-align:center;">',
    `  <a href="${escapeHtml(input.orderUrl)}" style="display:inline-block;padding:14px 28px;background:#d4820a;color:#fdfaf5;font-size:14px;font-weight:600;letter-spacing:0.02em;text-decoration:none;border-radius:999px;">`,
    `    ${escapeHtml(c.cta)}`,
    '  </a>',
    '</div>',
    '',
    `<p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#9c8b6a;text-align:center;">${c.footer(escapeHtml(input.settingsUrl))}</p>`,
  ].join('\n')

  const html = wrapEmailLayout({
    bodyHtml,
    preheader: c.preview(whenTimeOnly),
    restaurantName: input.restaurantName,
    locale: input.locale,
  })

  const text = [
    c.heading(input.orderRef),
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    '',
    `${c.itemsLabel}:`,
    ...input.items.map(
      (item) => `  ${item.quantity}x ${item.name} — ${formatMoney(item.lineTotalCents, input.currency, input.locale)}`
    ),
    `${c.totalLabel}: ${formatMoney(input.totalCents, input.currency, input.locale)}`,
    '',
    `${c.cta}: ${input.orderUrl}`,
  ].join('\n')

  return {
    subject: c.subject(input.orderRef, whenTimeOnly),
    html,
    text,
  }
}
