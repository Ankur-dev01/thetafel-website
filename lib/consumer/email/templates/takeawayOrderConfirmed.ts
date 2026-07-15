import 'server-only'
import { escapeHtml, firstNameOf } from '../escape'
import { wrapEmailLayout, type EmailLocale } from '../layout'

/**
 * Takeaway order-confirmed email — sent when Mollie confirms payment for a
 * pay-first takeaway order (C6.4). Mirrors renderBookingConfirmation's shape
 * closely (same layout wrapper, same money/date formatting conventions).
 */

export type TakeawayOrderConfirmedInput = {
  locale: EmailLocale
  guestFullName: string
  guestEmail: string
  restaurantName: string
  restaurantPhone: string | null
  restaurantAddress: {
    line1: string
    line2: string
  } | null
  orderRef: string
  pickupTime: Date | string
  items: Array<{ name: string; quantity: number; lineTotalCents: number }>
  totalCents: number
  currency: string
  /** Full URL including the magic-link token. */
  viewOrderUrl: string
}

export type RenderedEmail = {
  subject: string
  preheader: string
  html: string
  text: string
}

const COPY = {
  nl: {
    subjectTemplate: (r: string) => `Bestelling ontvangen — ${r}`,
    greeting: (n: string) => `Hi ${n},`,
    intro: 'Je afhaalbestelling is bevestigd. Hieronder de details:',
    pickupLabel: 'Afhaaltijd',
    refLabel: 'Bestelcode',
    itemsLabel: 'Bestelling',
    totalLabel: 'Totaal',
    whereLabel: 'Adres',
    phoneLabel: 'Telefoon',
    viewCta: 'Bekijk je bestelling',
    noteLine: 'Bewaar deze e-mail. De link geeft toegang tot de status van je bestelling.',
    preheader: (when: string) => `Afhalen op ${when}`,
  },
  en: {
    subjectTemplate: (r: string) => `Order confirmed — ${r}`,
    greeting: (n: string) => `Hi ${n},`,
    intro: 'Your takeaway order is confirmed. Here are your details:',
    pickupLabel: 'Pickup time',
    refLabel: 'Order code',
    itemsLabel: 'Order',
    totalLabel: 'Total',
    whereLabel: 'Address',
    phoneLabel: 'Phone',
    viewCta: 'View your order',
    noteLine: 'Keep this email. The link gives you access to your order status.',
    preheader: (when: string) => `Pickup at ${when}`,
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

function formatMoney(cents: number, currency: string, locale: EmailLocale): string {
  const fmtLocale = locale === 'en' ? 'en-GB' : 'nl-NL'
  return new Intl.NumberFormat(fmtLocale, {
    style: 'currency',
    currency: currency || 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

export function renderTakeawayOrderConfirmed(input: TakeawayOrderConfirmedInput): RenderedEmail {
  const t = COPY[input.locale]
  const firstName = firstNameOf(input.guestFullName, input.locale === 'en' ? 'there' : 'daar')
  const when = formatPickupTime(input.pickupTime, input.locale)

  const subject = t.subjectTemplate(input.restaurantName)
  const preheader = t.preheader(when)

  const itemRows = input.items
    .map(
      (item) => `
  <tr>
    <td style="padding:6px 0;font-size:14px;color:#0f0d08;">${item.quantity}&times; ${escapeHtml(item.name)}</td>
    <td style="padding:6px 0;font-size:14px;color:#0f0d08;text-align:right;">${formatMoney(item.lineTotalCents, input.currency, input.locale)}</td>
  </tr>`,
    )
    .join('')

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
    `    <td style="padding:6px 0;font-size:13px;color:#9c8b6a;width:140px;">${t.pickupLabel}</td>`,
    `    <td style="padding:6px 0;font-size:14px;color:#0f0d08;">${escapeHtml(when)}</td>`,
    '  </tr>',
    '  <tr>',
    `    <td style="padding:6px 0;font-size:13px;color:#9c8b6a;">${t.refLabel}</td>`,
    `    <td style="padding:6px 0;font-size:13px;color:#0f0d08;font-family:'SFMono-Regular',Consolas,monospace;">${escapeHtml(input.orderRef)}</td>`,
    '  </tr>',
    '</table>',
    '',
    `<div style="margin:0 0 8px;font-size:13px;color:#9c8b6a;">${t.itemsLabel}</div>`,
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 8px;">',
    itemRows,
    '</table>',
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px solid #f0e8d8;margin-top:8px;">',
    '  <tr>',
    `    <td style="padding:10px 0 0;font-size:14px;font-weight:700;color:#0f0d08;">${t.totalLabel}</td>`,
    `    <td style="padding:10px 0 0;font-size:14px;font-weight:700;color:#0f0d08;text-align:right;">${formatMoney(input.totalCents, input.currency, input.locale)}</td>`,
    '  </tr>',
    '</table>',
    '',
    addressBlock,
    phoneBlock,
    '',
    '<div style="margin-top:28px;text-align:center;">',
    `  <a href="${escapeHtml(input.viewOrderUrl)}" style="display:inline-block;padding:14px 28px;background:#0f0d08;color:#fdfaf5;font-size:14px;font-weight:600;letter-spacing:0.02em;text-decoration:none;border-radius:999px;">`,
    `    ${escapeHtml(t.viewCta)}`,
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

  const textLines: string[] = []
  textLines.push(t.greeting(firstName))
  textLines.push('')
  textLines.push(t.intro)
  textLines.push('')
  textLines.push(`${t.pickupLabel}: ${when}`)
  textLines.push(`${t.refLabel}: ${input.orderRef}`)
  textLines.push('')
  textLines.push(`${t.itemsLabel}:`)
  for (const item of input.items) {
    textLines.push(`  ${item.quantity}x ${item.name} — ${formatMoney(item.lineTotalCents, input.currency, input.locale)}`)
  }
  textLines.push(`${t.totalLabel}: ${formatMoney(input.totalCents, input.currency, input.locale)}`)
  if (input.restaurantAddress) {
    textLines.push('')
    textLines.push(`${t.whereLabel}: ${input.restaurantAddress.line1}, ${input.restaurantAddress.line2}`)
  }
  if (input.restaurantPhone) {
    textLines.push(`${t.phoneLabel}: ${input.restaurantPhone}`)
  }
  textLines.push('')
  textLines.push(`${t.viewCta}: ${input.viewOrderUrl}`)
  textLines.push('')
  textLines.push(t.noteLine)
  textLines.push('')
  textLines.push('—')
  textLines.push('The Tafel · thetafel.nl')

  return { subject, preheader, html, text: textLines.join('\n') }
}
