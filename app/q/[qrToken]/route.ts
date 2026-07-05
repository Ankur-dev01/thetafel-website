import { NextResponse, type NextRequest } from 'next/server'
import { createSupabasePublicClient } from '@/lib/consumer/supabasePublic'

const TOKEN_RE = /^[A-Za-z0-9_-]{20,32}$/

/**
 * Short-URL entry point for printed QR stickers: /q/{token}.
 *
 * Always 302s — never cached, so a token rotation takes effect immediately.
 * Deliberately reveals nothing about whether the token existed: any failure
 * mode redirects to the marketing root, same as an unrecognised token.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ qrToken: string }> }
) {
  const { qrToken } = await params

  if (!TOKEN_RE.test(qrToken)) {
    return redirectTo(req.nextUrl.origin)
  }

  const supabase = createSupabasePublicClient()

  const { data, error } = await supabase
    .from('restaurant_tables')
    .select('qr_token, is_qr_enabled, restaurants!inner(slug, service_qr_enabled, status)')
    .eq('qr_token', qrToken)
    .is('deleted_at', null)
    .maybeSingle()

  if (error || !data) {
    return redirectTo(req.nextUrl.origin)
  }

  const restaurant = data.restaurants as unknown as {
    slug: string
    service_qr_enabled: boolean
    status: string
  }

  if (
    !data.is_qr_enabled ||
    !restaurant.service_qr_enabled ||
    restaurant.status !== 'live'
  ) {
    return redirectTo(req.nextUrl.origin)
  }

  const target = `${req.nextUrl.origin}/r/${restaurant.slug}/qr/${qrToken}?qr=1`
  return redirectTo(target)
}

function redirectTo(url: string) {
  return new NextResponse(null, {
    status: 302,
    headers: {
      Location: url,
      'Cache-Control': 'no-store',
    },
  })
}
