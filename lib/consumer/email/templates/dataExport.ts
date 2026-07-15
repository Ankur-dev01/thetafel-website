import 'server-only'
import { escapeHtml, firstNameOf } from '../escape'
import { wrapEmailLayout, type EmailLocale } from '../layout'

/**
 * GDPR data-export email pair (C8.1):
 *   - renderDataExportLink: the "click here to receive your data" email,
 *     sent immediately when the guest submits the request page.
 *   - renderDataExportConfirmation: the follow-up "here's your data" email,
 *     sent with the JSON export attached once the guest clicks the link.
 */

export type RenderedEmail = {
  subject: string
  preheader: string
  html: string
  text: string
}

export type DataExportLinkInput = {
  locale: EmailLocale
  guestFullName: string
  /** Full URL including the magic-link token. */
  verifyUrl: string
}

export type DataExportConfirmationInput = {
  locale: EmailLocale
  guestFullName: string
  requestReference: string
}

const RESTAURANT_LABEL: Record<EmailLocale, string> = {
  nl: 'Privacy',
  en: 'Privacy',
}

const LINK_COPY = {
  nl: {
    subject: 'Je gegevensexport van The Tafel',
    preheader: 'Klik op de link om je gegevens te ontvangen',
    greeting: (n: string) => `Hi ${n},`,
    intro:
      'Je hebt gevraagd om een kopie van je gegevens bij The Tafel. Klik op de knop hieronder om te bevestigen — we sturen je dan direct een bestand met alles wat we van je hebben.',
    cta: 'Mijn gegevens ontvangen',
    noteLine: 'Deze link werkt 24 uur en kan maar één keer gebruikt worden.',
    ignoreLine: 'Heb je dit niet aangevraagd? Dan kun je deze e-mail negeren.',
  },
  en: {
    subject: 'Your data export from The Tafel',
    preheader: 'Click the link to receive your data',
    greeting: (n: string) => `Hi ${n},`,
    intro:
      'You asked for a copy of your data held by The Tafel. Click the button below to confirm — we will then email you a file with everything we hold about you.',
    cta: 'Send me my data',
    noteLine: 'This link is valid for 24 hours and can only be used once.',
    ignoreLine: "Didn't request this? You can safely ignore this email.",
  },
} as const

const CONFIRMATION_COPY = {
  nl: {
    subject: (ref: string) => `Je gegevens van The Tafel (${ref})`,
    preheader: 'Je gegevensexport is bijgevoegd als JSON-bestand',
    greeting: (n: string) => `Hi ${n},`,
    intro:
      'Hierbij het overzicht van alles wat The Tafel over je heeft opgeslagen, bij elk restaurant waar je hebt gereserveerd of besteld. Het bestand zit als bijlage bij deze e-mail.',
    refLabel: 'Referentie',
    noteLine:
      'Vragen over dit bestand? Beantwoord deze e-mail — vermeld de referentie hierboven.',
  },
  en: {
    subject: (ref: string) => `Your data from The Tafel (${ref})`,
    preheader: 'Your data export is attached as a JSON file',
    greeting: (n: string) => `Hi ${n},`,
    intro:
      'Attached is everything The Tafel has on file about you, across every restaurant you have booked or ordered from. The file is attached to this email.',
    refLabel: 'Reference',
    noteLine:
      'Questions about this file? Reply to this email — mention the reference above.',
  },
} as const

export function renderDataExportLink(input: DataExportLinkInput): RenderedEmail {
  const t = LINK_COPY[input.locale]
  const firstName = firstNameOf(input.guestFullName, input.locale === 'en' ? 'there' : 'daar')

  const bodyHtml = [
    `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#0f0d08;">${escapeHtml(t.greeting(firstName))}</p>`,
    `<p style="margin:0 0 22px;font-size:15px;line-height:1.55;color:#0f0d08;">${escapeHtml(t.intro)}</p>`,
    '<div style="margin-top:8px;text-align:center;">',
    `  <a href="${escapeHtml(input.verifyUrl)}" style="display:inline-block;padding:14px 28px;background:#0f0d08;color:#fdfaf5;font-size:14px;font-weight:600;letter-spacing:0.02em;text-decoration:none;border-radius:999px;">`,
    `    ${escapeHtml(t.cta)}`,
    '  </a>',
    '</div>',
    `<p style="margin:22px 0 0;font-size:12px;line-height:1.5;color:#9c8b6a;text-align:center;">${escapeHtml(t.noteLine)}</p>`,
    `<p style="margin:6px 0 0;font-size:12px;line-height:1.5;color:#9c8b6a;text-align:center;">${escapeHtml(t.ignoreLine)}</p>`,
  ].join('\n')

  const html = wrapEmailLayout({
    bodyHtml,
    preheader: t.preheader,
    restaurantName: RESTAURANT_LABEL[input.locale],
    locale: input.locale,
  })

  const text = [
    t.greeting(firstName),
    '',
    t.intro,
    '',
    `${t.cta}: ${input.verifyUrl}`,
    '',
    t.noteLine,
    t.ignoreLine,
    '',
    '—',
    'The Tafel · thetafel.nl',
  ].join('\n')

  return { subject: t.subject, preheader: t.preheader, html, text }
}

export function renderDataExportConfirmation(
  input: DataExportConfirmationInput
): RenderedEmail {
  const t = CONFIRMATION_COPY[input.locale]
  const firstName = firstNameOf(input.guestFullName, input.locale === 'en' ? 'there' : 'daar')
  const subject = t.subject(input.requestReference)

  const bodyHtml = [
    `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#0f0d08;">${escapeHtml(t.greeting(firstName))}</p>`,
    `<p style="margin:0 0 22px;font-size:15px;line-height:1.55;color:#0f0d08;">${escapeHtml(t.intro)}</p>`,
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f8f2e6;padding:18px 20px;margin:0 0 22px;">',
    '  <tr>',
    `    <td style="padding:6px 0;font-size:13px;color:#9c8b6a;width:140px;">${t.refLabel}</td>`,
    `    <td style="padding:6px 0;font-size:13px;color:#0f0d08;font-family:'SFMono-Regular',Consolas,monospace;">${escapeHtml(input.requestReference)}</td>`,
    '  </tr>',
    '</table>',
    `<p style="margin:22px 0 0;font-size:12px;line-height:1.5;color:#9c8b6a;">${escapeHtml(t.noteLine)}</p>`,
  ].join('\n')

  const html = wrapEmailLayout({
    bodyHtml,
    preheader: t.preheader,
    restaurantName: RESTAURANT_LABEL[input.locale],
    locale: input.locale,
  })

  const text = [
    t.greeting(firstName),
    '',
    t.intro,
    '',
    `${t.refLabel}: ${input.requestReference}`,
    '',
    t.noteLine,
    '',
    '—',
    'The Tafel · thetafel.nl',
  ].join('\n')

  return { subject, preheader: t.preheader, html, text }
}
