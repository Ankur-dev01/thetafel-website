'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { PublicRestaurant } from '@/lib/consumer/resolveRestaurant'
import { resolveBrandTokens } from '@/lib/consumer/brandTokens'
import type { MenuContext, MenuData } from '@/lib/menu/types'
import type { QrTable } from '@/lib/qr/resolveTable'
import { CategoryChips } from './CategoryChips'
import { MenuItemCard } from './MenuItemCard'

type Props = {
  restaurant: PublicRestaurant
  menu: MenuData
  table: QrTable
  context: MenuContext
  itemNotesEnabled: boolean
}

type ItemState = { qty: number; note: string }

export function MenuBrowser({
  restaurant,
  menu,
  itemNotesEnabled,
}: Props) {
  const brand = useMemo(() => resolveBrandTokens(restaurant), [restaurant])
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(
    menu.categories[0]?.id ?? null
  )
  const [itemState, setItemState] = useState<Map<string, ItemState>>(
    new Map()
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

  function getState(itemId: string): ItemState {
    return itemState.get(itemId) ?? { qty: 0, note: '' }
  }

  function updateState(itemId: string, next: Partial<ItemState>) {
    setItemState((prev) => {
      const copy = new Map(prev)
      const current = copy.get(itemId) ?? { qty: 0, note: '' }
      copy.set(itemId, { ...current, ...next })
      return copy
    })
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
            {category.items.map((item) => {
              const state = getState(item.id)
              return (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  brand={brand}
                  itemNotesEnabled={itemNotesEnabled}
                  qty={state.qty}
                  note={state.note}
                  onIncrement={() =>
                    updateState(item.id, { qty: state.qty + 1 })
                  }
                  onDecrement={() =>
                    updateState(item.id, {
                      qty: Math.max(0, state.qty - 1),
                      note: state.qty - 1 <= 0 ? '' : state.note,
                    })
                  }
                  onNoteChange={(note) => updateState(item.id, { note })}
                />
              )
            })}
          </section>
        ))}
      </div>
    </div>
  )
}
