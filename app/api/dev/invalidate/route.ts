import { NextRequest, NextResponse } from 'next/server'
import { invalidateConsumerPage, invalidateMenu } from '@/lib/consumer/cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' }

/**
 * Dev-only cache invalidation endpoint.
 *
 * Hard-blocked in production — returns 404 so the route appears not to exist.
 * Every response carries `Cache-Control: no-store` so an upstream caching
 * proxy never holds onto a successful or failed invalidation result.
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse(null, { status: 404, headers: NO_STORE })
  }

  const url = new URL(request.url)
  const slug = url.searchParams.get('slug')?.trim() ?? ''
  const menuRestaurantId =
    url.searchParams.get('menuRestaurantId')?.trim() ?? ''

  const actions: string[] = []

  if (slug) {
    invalidateConsumerPage(slug)
    actions.push(`invalidateConsumerPage(${slug})`)
  }
  if (menuRestaurantId) {
    invalidateMenu(menuRestaurantId)
    actions.push(`invalidateMenu(${menuRestaurantId})`)
  }

  if (actions.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Provide ?slug=... and/or ?menuRestaurantId=... to invalidate.',
      },
      { status: 400, headers: NO_STORE }
    )
  }

  return NextResponse.json(
    { ok: true, actions },
    { headers: NO_STORE }
  )
}
