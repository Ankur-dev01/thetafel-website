import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)

function inlineHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*([^*]+)\*\*/g, '<strong style="font-weight:600">$1</strong>')
    .replace(/`([^`]+)`/g, '<code style="background:#f8f2e6;padding:1px 4px;border-radius:3px;font-size:0.9em;font-family:monospace">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:#d4820a;text-decoration:underline">$1</a>')
}

function mdToHtml(md: string): string {
  const lines = md.split('\n')
  const out: string[] = []
  let inUl = false
  let inTable = false

  function closeUl() {
    if (inUl) { out.push('</ul>'); inUl = false }
  }
  function closeTable() {
    if (inTable) { out.push('</tbody></table>'); inTable = false }
  }

  for (const line of lines) {
    // Strip draft/blockquote warning lines
    if (line.startsWith('> ') || line === '>') {
      closeUl(); closeTable()
      continue
    }
    if (line.startsWith('# ')) {
      closeUl(); closeTable()
      out.push(`<h1 style="font-family:Georgia,serif;font-size:18px;font-weight:900;color:#1e1508;margin:20px 0 8px;line-height:1.3">${inlineHtml(line.slice(2))}</h1>`)
      continue
    }
    if (line.startsWith('## ')) {
      closeUl(); closeTable()
      out.push(`<h2 style="font-family:Arial,sans-serif;font-size:14px;font-weight:700;color:#1e1508;margin:18px 0 6px">${inlineHtml(line.slice(3))}</h2>`)
      continue
    }
    if (/^-{3,}$/.test(line.trim())) {
      closeUl(); closeTable()
      out.push('<hr style="border:none;border-top:1px solid #e8dece;margin:12px 0">')
      continue
    }
    if (line.startsWith('- ')) {
      closeTable()
      if (!inUl) { out.push('<ul style="padding-left:20px;margin:6px 0 10px">'); inUl = true }
      out.push(`<li style="margin-bottom:4px;color:#1e1508;font-size:13px;line-height:1.55">${inlineHtml(line.slice(2))}</li>`)
      continue
    }
    if (line.startsWith('|')) {
      closeUl()
      if (/^\|[-| :]+\|$/.test(line.trim())) continue
      const cells = line.split('|').slice(1, -1).map((c) => c.trim())
      if (!inTable) {
        out.push(
          '<table style="border-collapse:collapse;width:100%;font-size:12px;margin:10px 0">',
          '<thead><tr>',
          ...cells.map((c) => `<th style="padding:6px 8px;text-align:left;border-bottom:1px solid #ddd;font-weight:600;color:#1e1508;white-space:nowrap">${inlineHtml(c)}</th>`),
          '</tr></thead><tbody>'
        )
        inTable = true
      } else {
        out.push(
          '<tr>',
          ...cells.map((c, ci) =>
            `<td style="padding:5px 8px;border-bottom:1px solid #f0e8d8;color:${ci === 0 ? '#1e1508' : '#9c8b6a'};vertical-align:top">${inlineHtml(c)}</td>`
          ),
          '</tr>'
        )
      }
      continue
    }
    closeUl(); closeTable()
    // Skip blank lines — adjacent <p> tags provide spacing via margin
    if (line.trim() === '') continue
    out.push(`<p style="margin:0 0 8px;color:#1e1508;font-size:13px;line-height:1.55">${inlineHtml(line)}</p>`)
  }

  closeUl()
  closeTable()
  return out.join('\n')
}

function formatSignedAt(d: string | Date, locale: 'nl' | 'en'): string {
  try {
    const date = typeof d === 'string' ? new Date(d) : d
    return new Intl.DateTimeFormat(locale === 'nl' ? 'nl-NL' : 'en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Amsterdam',
    }).format(date)
  } catch {
    return String(d)
  }
}

export async function sendContractSignedEmail(args: {
  to: string
  restaurantLegalName: string
  contractMarkdown: string
  signedName: string
  signedAt: string
  signedIp: string
  signedUserAgent: string
  documentHash: string
  signatureImageBase64: string
  locale: 'nl' | 'en'
  contractVersion?: string
  termsVersion?: string
  dpaVersion?: string
}): Promise<void> {
  const {
    to,
    restaurantLegalName,
    contractMarkdown,
    signedName,
    signedAt,
    signedIp,
    signedUserAgent,
    documentHash,
    locale,
    contractVersion = '1.0',
    termsVersion = '1.0',
    dpaVersion = '1.0',
  } = args

  // Strip data-URL prefix if present
  const signedBase64 = args.signatureImageBase64.startsWith('data:')
    ? args.signatureImageBase64.slice(args.signatureImageBase64.indexOf(',') + 1)
    : args.signatureImageBase64

  const isNl = locale === 'nl'

  const subject = isNl
    ? 'Je contract met The Tafel — bevestigd'
    : 'Your contract with The Tafel — confirmed'

  const T = {
    greeting: isNl ? `Beste ${restaurantLegalName},` : `Dear ${restaurantLegalName},`,
    intro: isNl
      ? 'Bedankt voor je aanmelding bij The Tafel. Je contract is ondertekend en opgeslagen. Hieronder vind je een kopie voor je administratie.'
      : 'Thanks for signing up with The Tafel. Your contract has been signed and stored. A copy is below for your records.',
    contractLabel: isNl ? 'Contract' : 'Contract',
    evidenceLabel: isNl ? 'Ondertekeningsbewijs' : 'Signing evidence',
    signedBy: isNl ? 'Ondertekend door' : 'Signed by',
    dateTime: isNl ? 'Datum en tijd' : 'Date and time',
    ipAddress: isNl ? 'IP-adres' : 'IP address',
    browser: 'Browser',
    version: isNl ? 'Versie' : 'Version',
    hash: 'Document hash (SHA-256)',
    termsAccepted: isNl ? 'Algemene voorwaarden aanvaard' : 'General Terms accepted',
    dpaAccepted: isNl ? 'Verwerkersovereenkomst aanvaard' : 'Data Processing Agreement accepted',
    view: isNl ? 'bekijken' : 'view',
    signatureLabel: isNl ? 'Handtekening' : 'Signature',
    footer: 'hallo@thetafel.nl',
  }

  const contractHtml = mdToHtml(contractMarkdown)
  const signedAtFormatted = formatSignedAt(signedAt, locale)

  const evidenceRow = (label: string, value: string) =>
    `<tr><td style="padding:4px 12px 4px 0;color:#9c8b6a;width:180px;vertical-align:top;font-size:13px">${label}</td><td style="padding:4px 0;color:#1e1508;font-size:13px">${value}</td></tr>`

  const html = `<!DOCTYPE html>
<html lang="${locale}"><body style="margin:0;padding:0;background:#fdfaf5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1e1508;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fdfaf5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #f0e8d8;">
  <tr><td style="padding:28px 32px 20px;">
    <div style="font-family:Georgia,serif;font-weight:900;font-size:22px;color:#1e1508;letter-spacing:-0.02em;">the tafel</div>
  </td></tr>

  <tr><td style="padding:0 32px 20px;">
    <p style="margin:0 0 10px;font-size:15px;line-height:1.55;color:#1e1508;">${T.greeting}</p>
    <p style="margin:0;font-size:14px;line-height:1.6;color:#5b4f3a;">${T.intro}</p>
  </td></tr>

  <tr><td style="padding:20px 32px;border-top:1px solid #f0e8d8;">
    <div style="font-size:11px;font-weight:600;color:#9c8b6a;letter-spacing:0.16em;text-transform:uppercase;margin-bottom:14px;">${T.contractLabel}</div>
    ${contractHtml}
  </td></tr>

  <tr><td style="padding:20px 32px;background:#f8f2e6;border-top:1px solid #f0e8d8;">
    <div style="font-size:11px;font-weight:600;color:#9c8b6a;letter-spacing:0.16em;text-transform:uppercase;margin-bottom:14px;">${T.evidenceLabel}</div>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
      ${evidenceRow(T.signedBy, signedName)}
      ${evidenceRow(T.dateTime, signedAtFormatted)}
      ${evidenceRow(T.ipAddress, `<span style="font-family:'SFMono-Regular',Consolas,monospace;font-size:12px">${signedIp}</span>`)}
      ${evidenceRow(T.browser, `<span style="font-family:'SFMono-Regular',Consolas,monospace;font-size:11px;word-break:break-all">${signedUserAgent}</span>`)}
      ${evidenceRow(T.version, contractVersion)}
      ${evidenceRow(T.hash, `<span style="font-family:'SFMono-Regular',Consolas,monospace;font-size:11px;word-break:break-all">${documentHash}</span>`)}
      ${evidenceRow(T.termsAccepted, `v${termsVersion} — <a href="https://thetafel.nl/algemene-voorwaarden" style="color:#d4820a;text-decoration:underline">${T.view}</a>`)}
      ${evidenceRow(T.dpaAccepted, `v${dpaVersion} — <a href="https://thetafel.nl/verwerkersovereenkomst" style="color:#d4820a;text-decoration:underline">${T.view}</a>`)}
    </table>
  </td></tr>

  <tr><td style="padding:20px 32px;background:#ffffff;border-top:1px solid #f0e8d8;">
    <div style="font-size:11px;font-weight:600;color:#9c8b6a;letter-spacing:0.16em;text-transform:uppercase;margin-bottom:12px;">${T.signatureLabel}</div>
    <img src="cid:signature.png" alt="${signedName}" width="240" style="max-width:240px;height:auto;border:1px solid #f0e8d8;padding:6px;background:#ffffff;display:block;" />
  </td></tr>

  <tr><td style="padding:20px 32px 28px;text-align:center;font-size:12px;color:#9c8b6a;border-top:1px solid #f0e8d8;">
    <a href="mailto:hallo@thetafel.nl" style="color:#d4820a;text-decoration:underline;">hallo@thetafel.nl</a> &middot; <a href="https://thetafel.nl" style="color:#d4820a;text-decoration:underline;">thetafel.nl</a>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`

  await resend.emails.send({
    from: 'The Tafel <hallo@thetafel.nl>',
    to: [to],
    bcc: ['hallo@thetafel.nl'],
    subject,
    html,
    attachments: [
      {
        filename: 'signature.png',
        content: Buffer.from(signedBase64, 'base64'),
        contentId: 'signature.png',
      },
    ],
  })
}
