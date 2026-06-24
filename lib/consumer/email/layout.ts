import 'server-only'

/**
 * Render the shared HTML shell every consumer email lives inside.
 *
 * Table-based layout is mandatory for email — Outlook, Yahoo, Gmail mobile
 * all strip flexbox / grid. Inline styles only — `<style>` blocks get
 * stripped by Gmail and most webmail.
 */

export type EmailLocale = 'nl' | 'en'

const FOOTER_COPY: Record<EmailLocale, { poweredBy: string; privacy: string; reply: string }> = {
  nl: {
    poweredBy: 'Verstuurd via The Tafel',
    privacy: 'Privacybeleid',
    reply: 'Vragen? Beantwoord deze e-mail of bel het restaurant.',
  },
  en: {
    poweredBy: 'Sent via The Tafel',
    privacy: 'Privacy policy',
    reply: 'Questions? Reply to this email or call the restaurant.',
  },
}

export type WrapEmailLayoutInput = {
  /** Caller-supplied HTML body, interpolated into the body slot. */
  bodyHtml: string
  /** Preheader copy that shows in inbox preview, ~100 chars. */
  preheader: string
  /** Restaurant display name shown beneath the Tafel wordmark. */
  restaurantName: string
  locale: EmailLocale
}

export function wrapEmailLayout(input: WrapEmailLayoutInput): string {
  const { bodyHtml, preheader, restaurantName, locale } = input
  const footer = FOOTER_COPY[locale]
  const privacyHref =
    locale === 'en'
      ? 'https://thetafel.nl/en/privacybeleid'
      : 'https://thetafel.nl/privacybeleid'

  return [
    '<!DOCTYPE html>',
    `<html lang="${locale}" dir="ltr">`,
    '<head>',
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    '<title>The Tafel</title>',
    '</head>',
    '<body style="margin:0;padding:0;background:#fdfaf5;font-family:\'Helvetica Neue\',Helvetica,Arial,sans-serif;color:#0f0d08;">',
    '',
    '<!-- Preheader: hidden line that shows in inbox preview -->',
    '<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#fdfaf5;opacity:0;">',
    preheader,
    '</div>',
    '',
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fdfaf5;">',
    '<tr><td align="center" style="padding:32px 12px;">',
    '',
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #f0e8d8;">',
    '',
    '  <!-- Header: wordmark + restaurant name -->',
    '  <tr><td style="padding:32px 32px 20px;text-align:center;">',
    '    <div style="font-family:Georgia,\'Times New Roman\',serif;font-weight:900;font-size:24px;letter-spacing:-0.01em;color:#0f0d08;line-height:1;">',
    '      The Tafel',
    '    </div>',
    '    <div style="margin-top:8px;font-size:13px;letter-spacing:0.16em;text-transform:uppercase;color:#9c8b6a;">',
    `      ${restaurantName}`,
    '    </div>',
    '  </td></tr>',
    '',
    '  <!-- Amber divider -->',
    '  <tr><td style="padding:0 32px;">',
    '    <div style="height:2px;background:#d4820a;line-height:0;font-size:0;">&nbsp;</div>',
    '  </td></tr>',
    '',
    '  <!-- Body slot -->',
    '  <tr><td style="padding:28px 32px 24px;">',
    bodyHtml,
    '  </td></tr>',
    '',
    '  <!-- Amber divider -->',
    '  <tr><td style="padding:0 32px;">',
    '    <div style="height:2px;background:#d4820a;line-height:0;font-size:0;">&nbsp;</div>',
    '  </td></tr>',
    '',
    '  <!-- Footer -->',
    '  <tr><td style="padding:24px 32px 32px;text-align:center;font-size:12px;line-height:1.5;color:#9c8b6a;">',
    `    <div>${footer.reply}</div>`,
    '    <div style="margin-top:14px;">',
    '      <span style="font-family:Georgia,\'Times New Roman\',serif;font-weight:700;color:#0f0d08;">The Tafel</span>',
    '      &middot;',
    `      <span>${footer.poweredBy}</span>`,
    '      &middot;',
    `      <a href="${privacyHref}" style="color:#9c8b6a;text-decoration:underline;">${footer.privacy}</a>`,
    '    </div>',
    '  </td></tr>',
    '',
    '</table>',
    '</td></tr>',
    '</table>',
    '',
    '</body>',
    '</html>',
  ].join('\n')
}
