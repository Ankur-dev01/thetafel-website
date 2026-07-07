'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { PublicRestaurant } from '@/lib/consumer/resolveRestaurant'
import { resolveBrandTokens } from '@/lib/consumer/brandTokens'
import type { MenuContext, MenuData } from '@/lib/menu/types'
import type { QrTable } from '@/lib/qr/resolveTable'
import { CartProvider } from '@/lib/cart/CartContext'
import { CategoryChips } from './CategoryChips'
import { MenuItemCard } from './MenuItemCard'
import { CartStickyFooter } from './CartStickyFooter'
import { CartDrawer } from './CartDrawer'

type Props = {
  restaurant: PublicRestaurant
  menu: MenuData
  table: QrTable
  context: MenuContext
  itemNotesEnabled: boolean
}

export function MenuBrowser({
  restaurant,
  menu,
  table,
  context,
  itemNotesEnabled,
}: Props) {
  const brand = useMemo(() => resolveBrandTokens(restaurant), [restaurant])
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(
    menu.categories[0]?.id ?? null
  )
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map())

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('data-category-id')
            if (id) setActiveCategoryId(id)
          }
        }
      },
      { threshold: 0.4, rootMargin: '-80px 0px -60% 0px' }
    )

    for (const section of sectionRefs.current.values()) {
      observer.observe(section)
    }

    return () => observer.disconnect()
  }, [])

  function handleChipClick(categoryId: string) {
    const section = sectionRefs.current.get(categoryId)
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const backgroundStyle: CSSProperties = brand.menuTextureUrl
    ? {
        backgroundImage: `url(${brand.menuTextureUrl})`,
        backgroundSize: 'cover',
        backgroundAttachment: 'fixed',
        backgroundColor: 'var(--cream, #fdfaf5)',
      }
    : { backgroundColor: 'var(--cream, #fdfaf5)' }

  return (
    <CartProvider
      slug={restaurant.slug}
      context={context}
      restaurantId={restaurant.id}
      tableId={table.id}
      qrToken={table.qr_token}
    >
      <div style={backgroundStyle}>
        <CategoryChips
          categories={menu.categories.map((c) => ({ id: c.id, name: c.name }))}
          activeCategoryId={activeCategoryId}
          brand={brand}
          onChipClick={handleChipClick}
        />

        <div
          style={{
            maxWidth: '720px',
            margin: '0 auto',
            padding: '0 16px 120px',
          }}
        >
          {menu.categories.map((category) => (
            <section
              key={category.id}
              id={`category-${category.id}`}
              data-category-id={category.id}
              ref={(el) => {
                if (el) sectionRefs.current.set(category.id, el)
                else sectionRefs.current.delete(category.id)
              }}
              style={{ paddingTop: '24px' }}
            >
              <h2
                style={{
                  fontFamily: brand.headlineFontFamily,
                  fontWeight: 900,
                  fontSize: 'clamp(22px, 4vw, 28px)',
                  color: 'var(--night, #0f0d08)',
                  margin: '0 0 8px 0',
                }}
              >
                {category.name}
              </h2>
              {category.items.map((item) => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  brand={brand}
                  itemNotesEnabled={itemNotesEnabled}
                />
              ))}
            </section>
          ))}
        </div>

        <CartStickyFooter brand={brand} />
        <CartDrawer brand={brand} />
      </div>
    </CartProvider>
  )
}
