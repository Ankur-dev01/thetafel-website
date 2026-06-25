import { NextRequest, NextResponse } from 'next/server'
import { renderBookingConfirmation } from '@/lib/consumer/email/templates/bookingConfirmation'
import { sendConsumerEmail } from '@/lib/consumer/email/send'
import { sendBookingConfirmationNotification } from '@/lib/consumer/notifications/dispatcher'
import type { EmailLocale } from '@/lib/consumer/email/layout'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' }

/**
 * Dev-only email / dispatcher preview endpoint.
 *
 * Hard-404s in production.
 *
 *   GET ?template=booking_confirmation&locale=nl
 *     → renders the HTML in the browser
 *
 *   GET ?template=booking_confirmation&locale=nl&format=text
 *     → renders the plain-text version
 *
 *   GET ?template=booking_confirmation&locale=nl&send=you@example.com
 *     → sends the email only (skips the dispatcher)
 *
 *   GET ?dispatch=booking_confirmation&locale=nl&email=you@example.com&phone=+31612345678
 *     → calls the full dispatcher (email + WhatsApp if enabled).
 *       phone is optional; without it only email goes.
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse(null, { status: 404, headers: NO_STORE })
  }

  const url = new URL(request.url)
  const locale = (url.searchParams.get('locale') ?? 'nl') as EmailLocale

  // ── Dispatcher mode ────────────────────────────────────────────────────
  const dispatchIntent = url.searchParams.get('dispatch')
  if (dispatchIntent) {
    if (dispatchIntent !== 'booking_confirmation') {
      return NextResponse.json(
        {
          ok: false,
          error: `Unknown dispatch intent: ${dispatchIntent}. Available: booking_confirmation.`,
        },
        { status: 400, headers: NO_STORE }
      )
    }

    const email = url.searchParams.get('email')
    const phone = url.searchParams.get('phone') ?? null

    if (!email) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Provide ?email=you@example.com (and optionally &phone=+31...) to dispatch.',
        },
        { status: 400, headers: NO_STORE }
      )
    }

    const slotTime = new Date(Date.now() + 1000 * 60 * 60 * 24 * 3)
    const result = await sendBookingConfirmationNotification({
      locale,
      guestFullName: 'Jan van der Berg',
      guestEmail: email,
      guestPhone: phone,
      restaurantId: '288b0437-81da-4089-98e4-d89227a98004',
      restaurantName: 'Test EMZ Dagobert',
      restaurantSlug: 'draft-0abe63c4270d4e6e',
      restaurantPhone: '+31 20 555 1234',
      restaurantAddress: { line1: 'Damstraat 12a', line2: '1012XR Amsterdam' },
      bookingId: '00000000-0000-0000-0000-000000000001',
      bookingRef: 'TT-A7K9P3',
      slotTime,
      partySize: 4,
      durationMinutes: 120,
      depositAmountCents: 2000,
      depositCurrency: 'EUR',
      magicLinkToken: 'dev_preview_token',
    })

    return NextResponse.json(
      {
        action: 'notification_dispatch',
        intent: dispatchIntent,
        locale,
        to: { email, phone },
        result,
      },
      { headers: NO_STORE }
    )
  }

  // ── Template-only mode (existing C3.1 behaviour) ───────────────────────
  const template = url.searchParams.get('template') ?? 'booking_confirmation'
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

  const slotTime = new Date(Date.now() + 1000 * 60 * 60 * 24 * 3)
  const rendered = renderBookingConfirmation({
    locale,
    guestFullName: 'Jan van der Berg',
    guestEmail: 'jan@example.com',
    restaurantName: 'Test EMZ Dagobert',
    restaurantSlug: 'draft-0abe63c4270d4e6e',
    restaurantPhone: '+31 20 555 1234',
    restaurantAddress: { line1: 'Damstraat 12a', line2: '1012XR Amsterdam' },
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
      { action: 'email_preview_send', template, locale, to: sendTo, result },
      { headers: NO_STORE }
    )
  }

  if (format === 'text') {
    return new NextResponse(rendered.text, {
      headers: { ...NO_STORE, 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  return new NextResponse(rendered.html, {
    headers: { ...NO_STORE, 'Content-Type': 'text/html; charset=utf-8' },
  })
}
