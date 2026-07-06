export type MenuContext = 'qr' | 'takeaway'

export type MenuItem = {
  id: string
  categoryId: string
  name: string
  description: string | null
  priceCents: number
  currency: string
  photoUrl: string | null
  dietaryTags: string[]
  available: boolean
  displayOrder: number
}

export type MenuCategory = {
  id: string
  name: string
  displayOrder: number
  items: MenuItem[]
}

export type MenuData = {
  restaurantId: string
  context: MenuContext
  locale: 'nl' | 'en'
  categories: MenuCategory[]
}
