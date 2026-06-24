import { NextRequest, NextResponse } from 'next/server'
import { renderBookingConfirmation } from '@/lib/consumer/email/templates/bookingConfirmation'
import { sendConsumerEmail } from '@/lib/consumer/email/send'
import type { EmailLocale } from '@/lib/consumer/email/layout'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' }

/**
 * Dev-only email preview / send-test endpoint.
 *
 * Hard-404s in production.
 *
 *   GET ?template=booking_confirmation&locale=nl
 *     → renders the template HTML directly to the browser using mock data
 *
 *   GET ?template=booking_confirmation&locale=nl&format=text
 *     → renders the plain-text version as text/plain
 *
 *   GET ?template=booking_confirmation&locale=nl&send=you@example.com
 *     → actually sends via Resend; returns JSON with the Resend message id
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse(null, { status: 404, headers: NO_STORE })
  }

  const url = new URL(request.url)
  const template = url.searchParams.get('template') ?? 'booking_confirmation'
  const locale = (url.searchParams.get('locale') ?? 'nl') as EmailLocale
  const format = url.searchParams.get('format') ?? 'html'
  const sendTo = url.searchParams.get('send')

  if (template !== 'booking_confirmation') {
    return NextResponse.json(
      {
        ok: false,
        error: `Unknown template: ${template}. Currently available: booking_confirmation.`,
      },
      { status: 400, headers: NO_STORE }
    )
  }

  // Mock data. 3 days from now.
  const slotTime = new Date(Date.now() + 1000 * 60 * 60 * 24 * 3)

  const rendered = renderBookingConfirmation({
    locale,
    guestFullName: 'Jan van der Berg',
    guestEmail: 'jan@example.com',
    restaurantName: 'Test EMZ Dagobert',
    restaurantSlug: 'draft-0abe63c4270d4e6e',
    restaurantPhone: '+31 20 555 1234',
    restaurantAddress: {
      line1: 'Damstraat 12a',
      line2: '1012XR Amsterdam',
    },
    bookingRef: 'TT-A7K9P3',
    slotTime,
    partySize: 4,
    durationMinutes: 120,
    depositAmountCents: 2000,
    depositCurrency: 'EUR',
    manageUrl:
      'https://thetafel.nl/r/draft-0abe63c4270d4e6e/bookings/manage?t=dev_preview_token',
  })

  if (sendTo) {
    const result = await sendConsumerEmail({
      to: sendTo,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      templateKey: 'dev.booking_confirmation_preview',
      restaurantId: '288b0437-81da-4089-98e4-d89227a98004',
    })
    return NextResponse.json(
      {
        action: 'email_preview_send',
        template,
        locale,
        to: sendTo,
        result,
      },
      { headers: NO_STORE }
    )
  }

  if (format === 'text') {
    return new NextResponse(rendered.text, {
      headers: {
        ...NO_STORE,
        'Content-Type': 'text/plain; charset=utf-8',
      },
    })
  }

  return new NextResponse(rendered.html, {
    headers: {
      ...NO_STORE,
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}
