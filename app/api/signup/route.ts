import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY!)

function sanitize(str: string): string {
  return str.replace(/<[^>]*>/g, '').trim()
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function POST(request: NextRequest) {
  try {
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

    const { error: dbError } = await supabase.from('signups').insert([
      {
        naam,
        email,
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

    await resend.emails.send({
      from: 'The Tafel <onboarding@resend.dev>',
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