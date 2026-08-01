const EUR_FORMATTER = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' })

/** "€ 12,50" — cents to a locale-formatted EUR string. Amsterdam-only restaurant, one currency. */
export function formatCents(cents: number): string {
  return EUR_FORMATTER.format(cents / 100)
}
