import type { Cart, CartTotals } from './types'

/**
 * Menu prices are VAT-inclusive (Dutch hospitality convention), so the total
 * a guest pays equals the subtotal — VAT is extracted from that total for
 * display, never added on top.
 */
export function computeTotals(cart: Cart): CartTotals {
  let subtotalCents = 0
  let vatCents = 0
  let itemCount = 0

  for (const line of cart.lines) {
    const lineTotal = line.priceCents * line.quantity
    subtotalCents += lineTotal
    vatCents += Math.round((lineTotal * line.vatRateBp) / (10000 + line.vatRateBp))
    itemCount += line.quantity
  }

  return {
    subtotalCents,
    vatCents,
    totalCents: subtotalCents,
    itemCount,
  }
}

export function formatCents(cents: number, locale: 'nl' | 'en'): string {
  return new Intl.NumberFormat(locale === 'en' ? 'en-NL' : 'nl-NL', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100)
}
