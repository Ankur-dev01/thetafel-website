import { NextResponse, type NextRequest } from 'next/server'
import { resolveRestaurantBySlug } from '@/lib/consumer/resolveRestaurant'
import { fetchMenu } from '@/lib/menu/fetchMenu'
import type { MenuContext } from '@/lib/menu/types'

export const revalidate = 60

const SLUG_RE = /^[a-z0-9-]{1,64}$/

function resolveLocale(req: NextRequest): 'nl' | 'en' {
  const header = req.headers.get('accept-language') ?? ''
  return header.toLowerCase().startsWith('en') ? 'en' : 'nl'
}

function resolveContext(req: NextRequest): MenuContext {
  const raw = new URL(req.url).searchParams.get('context')
  return raw === 'takeaway' ? 'takeaway' : 'qr'
}

/**
 * GET /api/v1/public/{slug}/menu?context=qr|takeaway
 *
 * Public read of a restaurant's menu. C5.2 server pages fetch the menu
 * directly via `fetchMenu`; this endpoint exists for C5.3+ client-side
 * cart-refresh reloads.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params

  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const restaurant = await resolveRestaurantBySlug(slug)
  if (!restaurant) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const context = resolveContext(req)
  const locale = resolveLocale(req)

  const menuData = await fetchMenu(restaurant.id, context, locale)

  return NextResponse.json(menuData, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  })
}
