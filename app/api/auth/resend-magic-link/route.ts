import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const supabaseProd = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_PROD_URL!,
  process.env.SUPABASE_PROD_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY!)

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(3, '1 h'),
  analytics: false,
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = (body.email || '').trim().toLowerCase()

    if (!email) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 })
    }

    const { success } = await ratelimit.limit(email)

    if (!success) {
      return NextResponse.json(
        { error: 'Too many resend attempts. Please try again in 1 hour.' },
        { status: 429, headers: { 'Retry-After': '3600' } }
      )
    }

    const { data: linkData, error: linkError } = await supabaseProd.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo: 'https://thetafel.nl/auth/confirm',
      },
    })

    if (linkError || !linkData?.properties?.action_link) {
      return NextResponse.json({ error: 'Could not generate link.' }, { status: 500 })
    }

    const magicLink = linkData.properties.action_link

    await resend.emails.send({
      from: 'The Tafel <hallo@thetafel.nl>',
      to: email,
      subject: 'Activeer je Tafel account — link geldig voor 1 uur',
      html: `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background-color:#f0e8d8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0e8d8;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
        <tr><td align="center" style="padding:0 0 32px 0;">
          <div style="font-size:9px;font-weight:700;letter-spacing:0.32em;text-transform:uppercase;color:#d4820a;margin-bottom:2px;text-align:center;">THE</div>
          <div style="font-family:Georgia,serif;font-size:28px;font-weight:900;color:#1e1508;text-align:center;">TAFEL</div>
        </td></tr>
        <tr><td style="background-color:#fdfaf5;border-radius:20px;padding:48px;">
          <p style="margin:0 0 16px 0;font-size:11px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:#d4820a;">Activatielink</p>
          <h1 style="margin:0 0 16px 0;font-family:Georgia,serif;font-size:28px;font-weight:900;color:#1e1508;">Jouw Tafel account is klaar.</h1>
          <p style="margin:0 0 32px 0;font-size:16px;font-weight:300;line-height:1.75;color:#9c8b6a;">Klik op de knop hieronder om in te loggen. De link is <strong style="color:#1e1508;">1 uur geldig</strong> en kan maar een keer worden gebruikt.</p>
          <table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 32px 0;">
            <tr><td style="border-radius:100px;background:linear-gradient(135deg,#d4820a,#b86d08);">
              <a href="${magicLink}" style="display:inline-block;padding:16px 40px;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#fdfaf5;text-decoration:none;border-radius:100px;">Activeer mijn account</a>
            </td></tr>
          </table>
          <p style="margin:0 0 8px 0;font-size:12px;color:#9c8b6a;">Werkt de knop niet? Kopieer deze link:</p>
          <p style="margin:0;font-size:11px;color:#d4820a;word-break:break-all;">${magicLink}</p>
        </td></tr>
        <tr><td align="center" style="padding:32px 0 0 0;">
          <p style="margin:0;font-size:12px;color:#9c8b6a;">The Tafel &mdash; KVK: 42027611 &mdash; hallo@thetafel.nl</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Resend magic link error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
