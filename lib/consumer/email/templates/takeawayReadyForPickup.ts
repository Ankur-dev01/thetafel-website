import 'server-only'
import { escapeHtml, firstNameOf } from '../escape'
import { wrapEmailLayout, type EmailLocale } from '../layout'

/**
 * "Your order is ready" email. See lib/consumer/notifications/
 * dispatchTakeawayReady.ts for when this actually gets sent (not wired to
 * any trigger in Phase 2 — Phase 3's staff dashboard calls it when the
 * kitchen marks an order 'ready').
 */

export type TakeawayReadyForPickupInput = {
  locale: EmailLocale
  guestFullName: string
  restaurantName: string
  restaurantPhone: string | null
  restaurantAddress: {
    line1: string
    line2: string
  } | null
  orderRef: string
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
    subjectTemplate: (r: string) => `Klaar om af te halen — ${r}`,
    greeting: (n: string) => `Hi ${n},`,
    intro: 'Goed nieuws — je bestelling staat klaar om afgehaald te worden.',
    refLabel: 'Bestelcode',
    whereLabel: 'Adres',
    phoneLabel: 'Telefoon',
    viewCta: 'Bekijk je bestelling',
    preheader: 'Je bestelling staat klaar.',
  },
  en: {
    subjectTemplate: (r: string) => `Ready for pickup — ${r}`,
    greeting: (n: string) => `Hi ${n},`,
    intro: 'Good news — your order is ready for pickup.',
    refLabel: 'Order code',
    whereLabel: 'Address',
    phoneLabel: 'Phone',
    viewCta: 'View your order',
    preheader: 'Your order is ready.',
  },
} as const

export function renderTakeawayReadyForPickup(input: TakeawayReadyForPickupInput): RenderedEmail {
  const t = COPY[input.locale]
  const firstName = firstNameOf(input.guestFullName, input.locale === 'en' ? 'there' : 'daar')

  const subject = t.subjectTemplate(input.restaurantName)
  const preheader = t.preheader

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
    `    <td style="padding:6px 0;font-size:13px;color:#9c8b6a;width:140px;">${t.refLabel}</td>`,
    `    <td style="padding:6px 0;font-size:13px;color:#0f0d08;font-family:'SFMono-Regular',Consolas,monospace;">${escapeHtml(input.orderRef)}</td>`,
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
  textLines.push(`${t.refLabel}: ${input.orderRef}`)
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
  textLines.push('—')
  textLines.push('The Tafel · thetafel.nl')

  return { subject, preheader, html, text: textLines.join('\n') }
}
