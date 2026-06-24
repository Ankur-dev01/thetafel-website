import 'server-only'
import { revalidatePath, revalidateTag } from 'next/cache'

/**
 * Tag for cache entries scoped to a single restaurant's consumer pages.
 * Used with `fetch(url, { next: { tags: [consumerPageTag(slug)] } })` when
 * we add fetch-based public data calls (e.g. cached external images).
 */
export function consumerPageTag(slug: string): string {
  return `consumer:r:${slug}`
}

/**
 * Tag for cache entries scoped to a single restaurant's menu.
 * Phase 5 (QR / takeaway) will tag menu fetches with this; Phase 3 dashboard
 * write-paths call `invalidateMenu()` when a menu item changes.
 */
export function menuTag(restaurantId: string): string {
  return `consumer:menu:${restaurantId}`
}

/**
 * Purge the cached HTML for a single restaurant's consumer pages.
 *
 * Call this from any server action / API route that mutates restaurant data
 * the public page depends on:
 *   - restaurant profile (name, photo, cuisine, hours, address, phone)
 *   - service enablement toggles
 *   - booking rules / capacity (affects /book)
 *   - takeaway settings (affects /order)
 *   - QR settings (affects /qr/*)
 *
 * Invalidates both locales in a single call and also drops the page tag so
 * any tagged fetches under the route are refreshed on the next render.
 *
 * Safe to call with an unknown slug — no-ops.
 */
export function invalidateConsumerPage(slug: string): void {
  if (!slug || typeof slug !== 'string') return

  // Both locales. 'layout' type revalidates this path and every nested route
  // beneath it, so /book, /order, /qr/[tableId] all become stale together.
  revalidatePath(`/r/${slug}`, 'layout')
  revalidatePath(`/en/r/${slug}`, 'layout')

  // For any tagged fetches under the consumer pages (none yet — placeholder
  // for future menu image caching, sitemap entries, etc.)
  // expire: 0 forces immediate expiration so the next visitor gets fresh data.
  revalidateTag(consumerPageTag(slug), { expire: 0 })
}

/**
 * Purge cached menu fetches for a single restaurant.
 *
 * Call from menu edit endpoints in Phase 3. Currently no consumer fetches
 * are tagged with `menuTag()`; Phase 5 (QR ordering) wires this up.
 */
export function invalidateMenu(restaurantId: string): void {
  if (!restaurantId || typeof restaurantId !== 'string') return
  revalidateTag(menuTag(restaurantId), { expire: 0 })
}
