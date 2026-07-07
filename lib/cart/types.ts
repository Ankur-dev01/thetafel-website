export type CartContext = 'qr' | 'takeaway'

export type CartLine = {
  itemId: string
  name: string
  priceCents: number
  vatRateBp: number
  quantity: number
  note: string
}

export type Cart = {
  slug: string
  context: CartContext
  restaurantId: string
  tableId: string | null
  lines: CartLine[]
  updatedAt: number
}

export type CartTotals = {
  subtotalCents: number
  vatCents: number
  totalCents: number
  itemCount: number
}
