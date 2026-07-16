import 'server-only'
import { escapeHtml, firstNameOf } from '../escape'
import { wrapEmailLayout, type EmailLocale } from '../layout'

/**
 * GDPR data-deletion email pair (C8.2), mirrors dataExport.ts exactly:
 *   - renderDataDeletionLink: the "click here to confirm deletion" email.
 *   - renderDataDeletionConfirmation: the follow-up "your data has been
 *     deleted" email, sent with the PDF confirmation attached.
 */

export type RenderedEmail = {
  subject: string
  preheader: string
  html: string
  text: string
}

export type DataDeletionLinkInput = {
  locale: EmailLocale
  guestFullName: string
  /** Full URL including the magic-link token. */
  verifyUrl: string
}

export type DataDeletionConfirmationInput = {
  locale: EmailLocale
  requestReference: string
}

const RESTAURANT_LABEL: Record<EmailLocale, string> = {
  nl: 'Privacy',
  en: 'Privacy',
}

const LINK_COPY = {
  nl: {
    subject: 'Bevestig het verwijderen van je gegevens bij The Tafel',
    preheader: 'Klik op de link om te bevestigen',
    greeting: (n: string) => `Hi ${n},`,
    intro:
      'Je hebt gevraagd om je gegevens bij The Tafel te laten verwijderen. Dit kan niet ongedaan worden gemaakt. Klik op de knop hieronder om te bevestigen.',
    cta: 'Verwijdering bevestigen',
    noteLine: 'Deze link werkt 24 uur en kan maar één keer gebruikt worden.',
    ignoreLine: 'Heb je dit niet aangevraagd? Dan kun je deze e-mail negeren.',
  },
  en: {
    subject: 'Confirm deleting your data at The Tafel',
    preheader: 'Click the link to confirm',
    greeting: (n: string) => `Hi ${n},`,
    intro:
      'You asked to have your data at The Tafel deleted. This cannot be undone. Click the button below to confirm.',
    cta: 'Confirm deletion',
    noteLine: 'This link is valid for 24 hours and can only be used once.',
    ignoreLine: "Didn't request this? You can safely ignore this email.",
  },
} as const

const CONFIRMATION_COPY = {
  nl: {
    subject: (ref: string) => `Je gegevens zijn verwijderd (${ref})`,
    preheader: 'Bevestiging van verwijdering bijgevoegd als PDF',
    greeting: 'Hallo,',
    intro:
      'Je gegevens bij The Tafel zijn verwijderd. Alles wat je identificeert is vervangen door een plaatshouder; reserverings- en bestelgegevens blijven geanonimiseerd bewaard zoals wettelijk vereist. De bevestiging zit als PDF bij deze e-mail.',
    refLabel: 'Referentie',
    noteLine:
      'Vragen over deze verwijdering? Beantwoord deze e-mail — vermeld de referentie hierboven.',
  },
  en: {
    subject: (ref: string) => `Your data has been deleted (${ref})`,
    preheader: 'Deletion confirmation attached as a PDF',
    greeting: 'Hello,',
    intro:
      'Your data at The Tafel has been deleted. Everything identifying you has been replaced with a placeholder; booking and order records remain, anonymised, as legally required. The confirmation is attached to this email as a PDF.',
    refLabel: 'Reference',
    noteLine:
      'Questions about this deletion? Reply to this email — mention the reference above.',
  },
} as const

export function renderDataDeletionLink(input: DataDeletionLinkInput): RenderedEmail {
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

export function renderDataDeletionConfirmation(
  input: DataDeletionConfirmationInput
): RenderedEmail {
  const t = CONFIRMATION_COPY[input.locale]
  const subject = t.subject(input.requestReference)

  const bodyHtml = [
    `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#0f0d08;">${escapeHtml(t.greeting)}</p>`,
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
    t.greeting,
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
