import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

function sanitize(str: string): string {
  return str.replace(/<[^>]*>/g, '').trim()
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function POST(request: NextRequest) {
  console.log('ENV CHECK:', {
    prodUrl: process.env.NEXT_PUBLIC_SUPABASE_PROD_URL ? 'SET' : 'MISSING',
    prodKey: process.env.SUPABASE_PROD_SERVICE_ROLE_KEY ? 'SET' : 'MISSING',
    marketingUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING',
    marketingKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING',
    resendKey: process.env.RESEND_API_KEY ? 'SET' : 'MISSING',
    upstashUrl: process.env.UPSTASH_REDIS_REST_URL ? 'SET' : 'MISSING',
  })
  try {
    // Rate limiting by IP
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      '127.0.0.1'

    const isDev = process.env.NODE_ENV === 'development'
    const { success, limit, reset, remaining } = await ratelimit.limit(ip)

    if (!success && !isDev) {
      return NextResponse.json(
        {
          error: 'RATE_LIMIT_EXCEEDED',
          code: 'RATE_LIMIT_EXCEEDED',
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': reset.toString(),
            'Retry-After': '3600',
          },
        }
      )
    }

    const body = await request.json()

    const naam = sanitize(body.naam || '')
    const email = sanitize(body.email || '')
    const telefoon = sanitize(body.telefoon || '')
    const restaurant = sanitize(body.restaurant || '')
    const stad = sanitize(body.stad || '')
    const bron = sanitize(body.bron || 'website')

    if (!naam || !email || !restaurant || !stad) {
      return NextResponse.json(
        { error: 'Naam, email, restaurant en stad zijn verplicht.' },
        { status: 400 }
      )
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Ongeldig e-mailadres.' },
        { status: 400 }
      )
    }

    // Check email uniqueness against Supabase Auth in prod project
    const { data: existingAuthUser } = await supabaseProd.auth.admin.listUsers()
    const userExists = existingAuthUser?.users?.some(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    )

    if (userExists) {
      return NextResponse.json(
        {
          error: 'EMAIL_ALREADY_REGISTERED',
          code: 'EMAIL_ALREADY_REGISTERED',
        },
        { status: 409 }
      )
    }

    const { error: dbError } = await supabase.from('signups').insert([
      {
        naam,
        email: email.toLowerCase(),
        telefoon,
        restaurant,
        stad,
        bron,
      },
    ])

    if (dbError) {
      console.error('Supabase error:', dbError)
      return NextResponse.json(
        { error: 'Er is een fout opgetreden. Probeer het opnieuw.' },
        { status: 500 }
      )
    }

    // Create Supabase Auth user in thetafel-prod
    const { error: authError } = await supabaseProd.auth.admin.createUser({
      email: email.toLowerCase(),
      email_confirm: false,
    })

    if (authError && authError.message !== 'User already registered') {
      console.error('Auth user creation error:', authError)
    }

    // Generate magic link
    const { data: linkData, error: linkError } = await supabaseProd.auth.admin.generateLink({
      type: 'magiclink',
      email: email.toLowerCase(),
      options: {
        redirectTo: 'https://thetafel.nl/auth/confirm',
      },
    })

    console.log('LINK DATA:', JSON.stringify(linkData, null, 2))
    console.log('LINK ERROR:', linkError)

    if (!linkError && linkData?.properties?.action_link) {
      const magicLink = linkData.properties.action_link

      const { data: magicEmailData, error: magicEmailError } = await resend.emails.send({
        from: 'The Tafel <hallo@thetafel.nl>',
        to: email.toLowerCase(),
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
      console.log('MAGIC EMAIL RESULT:', { data: magicEmailData, error: magicEmailError })
    }

    const { data: teamEmailData, error: teamEmailError } = await resend.emails.send({
      from: 'The Tafel <hallo@thetafel.nl>',
      to: 'hallo@thetafel.nl',
      subject: `Nieuwe aanmelding: ${restaurant} — ${stad}`,
      html: `
        <h2>Nieuwe restaurant aanmelding</h2>
        <p><strong>Naam:</strong> ${naam}</p>
        <p><strong>E-mail:</strong> ${email}</p>
        <p><strong>Telefoon:</strong> ${telefoon || 'Niet opgegeven'}</p>
        <p><strong>Restaurant:</strong> ${restaurant}</p>
        <p><strong>Stad:</strong> ${stad}</p>
        <p><strong>Bron:</strong> ${bron}</p>
        <hr />
        <p style="color: #9c8b6a; font-size: 12px;">The Tafel — thetafel.nl</p>
      `,
    })
    console.log('TEAM EMAIL RESULT:', { data: teamEmailData, error: teamEmailError })

    return NextResponse.json(
      { success: true, message: 'Aanmelding ontvangen.' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: 'Er is een fout opgetreden. Probeer het opnieuw.' },
      { status: 500 }
    )
  }
}