'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { PublicRestaurant } from '@/lib/consumer/resolveRestaurant'
import { resolveBrandTokens } from '@/lib/consumer/brandTokens'
import type { MenuData } from '@/lib/menu/types'
import { CategoryChips } from './CategoryChips'
import { MenuItemCard } from './MenuItemCard'
import { CartStickyFooter } from './CartStickyFooter'
import { CartDrawer } from './CartDrawer'

type Props = {
  restaurant: PublicRestaurant
  menu: MenuData
  itemNotesEnabled: boolean
  orderingDisabled?: boolean
}

/**
 * Relies on an ambient CartProvider from a parent layout (qr/[qrToken]/layout.tsx
 * or order/layout.tsx) — it no longer mounts its own, so the cart survives
 * navigation to sibling pages within the same flow instead of remounting here.
 */
export function MenuBrowser({
  restaurant,
  menu,
  itemNotesEnabled,
  orderingDisabled = false,
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
      { threshold: 0, rootMargin: '-120px 0px -55% 0px' }
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
    <>
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
          {menu.categories.map((category, index) => (
            <section
              key={category.id}
              id={`category-${category.id}`}
              data-category-id={category.id}
              ref={(el) => {
                if (el) sectionRefs.current.set(category.id, el)
                else sectionRefs.current.delete(category.id)
              }}
              style={{ paddingTop: index === 0 ? '24px' : '56px' }}
            >
              <h2
                style={{
                  fontFamily: brand.headlineFontFamily,
                  fontWeight: 900,
                  fontSize: 'clamp(24px, 4vw, 30px)',
                  color: '#a86205',
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
                  orderingDisabled={orderingDisabled}
                />
              ))}
            </section>
          ))}
        </div>

        <CartStickyFooter brand={brand} orderingDisabled={orderingDisabled} />
        <CartDrawer brand={brand} />
      </div>
    </>
  )
}
