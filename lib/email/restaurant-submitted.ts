import { Resend } from 'resend'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_ADDRESS = 'The Tafel <hallo@thetafel.nl>'
const ADMIN_INBOX = 'hallo@thetafel.nl'

type Args = {
  legalName: string
  restaurantId: string
  contactEmail: string | null
  subscriptionTier: string | null
  servicesEnabled: {
    reservations: boolean
    takeaway: boolean
    qr: boolean
  }
  qrPlan: string | null
  submittedAt: string
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildHtml(args: Args): string {
  const services: string[] = []
  if (args.servicesEnabled.reservations) services.push('Reservations')
  if (args.servicesEnabled.takeaway) services.push('Takeaway')
  if (args.servicesEnabled.qr) {
    services.push(args.qrPlan ? `QR (${args.qrPlan})` : 'QR')
  }

  const rows: Array<[string, string]> = [
    ['Restaurant', args.legalName],
    ['Restaurant ID', args.restaurantId],
    ['Contact email', args.contactEmail ?? '—'],
    ['Subscription tier', args.subscriptionTier ?? '—'],
    ['Services enabled', services.length ? services.join(', ') : '—'],
    ['Submitted at', args.submittedAt],
  ]

  const rowsHtml = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:8px 16px;background:#fdfaf5;border-bottom:1px solid #f0e8d8;font-family:Jost,Arial,sans-serif;font-size:13px;color:#6b5b3f;font-weight:500;white-space:nowrap;">${escapeHtml(label)}</td>
          <td style="padding:8px 16px;background:#ffffff;border-bottom:1px solid #f0e8d8;font-family:Jost,Arial,sans-serif;font-size:14px;color:#1e1508;">${escapeHtml(value)}</td>
        </tr>`
    )
    .join('')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>New restaurant submitted for review</title>
  </head>
  <body style="margin:0;padding:24px;background:#fdfaf5;font-family:Jost,Arial,sans-serif;color:#1e1508;">
    <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #f0e8d8;border-radius:8px;overflow:hidden;">
      <tr>
        <td style="padding:24px;background:#1e1508;color:#fdfaf5;">
          <div style="font-family:Raleway,Arial,sans-serif;font-weight:900;font-size:20px;letter-spacing:0.02em;">The Tafel</div>
          <div style="font-family:Jost,Arial,sans-serif;font-size:13px;color:#d4820a;margin-top:4px;">New submission</div>
        </td>
      </tr>
      <tr>
        <td style="padding:24px;">
          <h1 style="margin:0 0 16px;font-family:Raleway,Arial,sans-serif;font-weight:900;font-size:22px;color:#1e1508;">${escapeHtml(args.legalName)} submitted for review</h1>
          <p style="margin:0 0 20px;font-family:Jost,Arial,sans-serif;font-size:14px;color:#6b5b3f;line-height:1.55;">A restaurant has completed onboarding and is awaiting review. Approve them by flipping <code style="background:#fdfaf5;padding:2px 6px;border-radius:3px;font-size:12px;">restaurants.status</code> to <code style="background:#fdfaf5;padding:2px 6px;border-radius:3px;font-size:12px;">live</code> in Supabase, then update the matching <code style="background:#fdfaf5;padding:2px 6px;border-radius:3px;font-size:12px;">review_tasks</code> row.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #f0e8d8;border-radius:6px;overflow:hidden;">
            ${rowsHtml}
          </table>
          <p style="margin:24px 0 0;font-family:Jost,Arial,sans-serif;font-size:12px;color:#9c8b6a;line-height:1.55;">Admin tooling is not yet live. Approve via Supabase MCP until the admin UI ships.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

export async function sendRestaurantSubmittedEmail(args: Args): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn('[restaurant-submitted] RESEND_API_KEY missing — skipping email')
    return
  }

  const resend = new Resend(RESEND_API_KEY)
  const subject = `New restaurant submitted for review — ${args.legalName}`
  const html = buildHtml(args)

  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: ADMIN_INBOX,
    subject,
    html,
  })

  if (error) {
    throw new Error(`Resend failed: ${error.name ?? 'unknown'} — ${error.message ?? ''}`)
  }
}
