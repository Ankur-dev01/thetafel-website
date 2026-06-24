import { NextRequest, NextResponse } from 'next/server'
import { invalidateConsumerPage, invalidateMenu } from '@/lib/consumer/cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Dev-only cache invalidation endpoint.
 *
 * Hard-blocked in production — returns 404 so the route appears not to exist.
 *
 * Usage (local dev):
 *   GET /api/dev/invalidate?slug=draft-0abe63c4270d4e6e
 *   GET /api/dev/invalidate?menuRestaurantId=<uuid>
 *   GET /api/dev/invalidate?slug=...&menuRestaurantId=<uuid>   (both)
 *
 * In Phase 3 the dashboard write paths will call `invalidateConsumerPage()`
 * and `invalidateMenu()` directly — this endpoint exists solely so we can
 * prove the wiring works before that dashboard exists.
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse(null, { status: 404 })
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
      { status: 400 }
    )
  }

  return NextResponse.json({ ok: true, actions })
}
