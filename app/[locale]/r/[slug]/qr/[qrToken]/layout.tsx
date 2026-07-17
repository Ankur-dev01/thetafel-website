import type { ReactNode } from 'react'
import { resolveTable } from '@/lib/qr/resolveTable'
import { CartProvider } from '@/lib/cart/CartContext'

const TOKEN_RE = /^[A-Za-z0-9_-]{20,32}$/

/**
 * Wraps every page under /r/[slug]/qr/[qrToken]/... in a single CartProvider
 * instance. Next.js preserves a layout's component instance across
 * client-side navigation between sibling pages that share the same dynamic
 * params, so the cart survives moving from the menu to checkout to pay
 * instead of remounting (and losing in-memory state until the localStorage
 * rehydrate effect catches up) on every page.
 *
 * resolveTable is wrapped in React.cache, so this costs no extra Supabase
 * round-trip beyond what each page already does.
 */
export default async function QrTokenLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string; qrToken: string }>
  children: ReactNode
}) {
  const { slug, qrToken } = await params

  if (!TOKEN_RE.test(qrToken)) {
    return <>{children}</>
  }

  const result = await resolveTable(slug, qrToken)
  if (result.status !== 'ok') {
    return <>{children}</>
  }

  const { restaurant, table } = result

  return (
    <CartProvider
      slug={slug}
      context="qr"
      restaurantId={restaurant.id}
      tableId={table.id}
      qrToken={table.qr_token}
    >
      {children}
    </CartProvider>
  )
}
