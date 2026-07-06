'use client'

import { useEffect, useRef } from 'react'
import type { ResolvedBrand } from '@/lib/consumer/brandTokens'

type Props = {
  categories: { id: string; name: string }[]
  activeCategoryId: string | null
  brand: ResolvedBrand
  onChipClick: (categoryId: string) => void
}

export function CategoryChips({
  categories,
  activeCategoryId,
  brand,
  onChipClick,
}: Props) {
  const chipRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  useEffect(() => {
    if (!activeCategoryId) return
    const chip = chipRefs.current.get(activeCategoryId)
    chip?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }, [activeCategoryId])

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        background: 'rgba(253, 250, 245, 0.92)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(30, 21, 8, 0.06)',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: '8px',
          padding: '12px 16px',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
        }}
      >
        {categories.map((category) => {
          const active = category.id === activeCategoryId
          return (
            <button
              key={category.id}
              type="button"
              ref={(el) => {
                if (el) chipRefs.current.set(category.id, el)
                else chipRefs.current.delete(category.id)
              }}
              onClick={() => onChipClick(category.id)}
              style={{
                padding: '8px 16px',
                borderRadius: '999px',
                fontFamily: 'var(--font-jost), sans-serif',
                fontWeight: 600,
                fontSize: '14px',
                whiteSpace: 'nowrap',
                scrollSnapAlign: 'start',
                cursor: 'pointer',
                background: active ? brand.primaryHex : 'transparent',
                color: active ? '#fff' : 'var(--night, #0f0d08)',
                border: active
                  ? `1px solid ${brand.primaryHex}`
                  : '1px solid rgba(30, 21, 8, 0.15)',
              }}
            >
              {category.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
