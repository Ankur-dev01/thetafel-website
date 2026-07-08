'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import type { ResolvedBrand } from '@/lib/consumer/brandTokens'
import type { MenuItem } from '@/lib/menu/types'
import { splitTags } from '@/lib/menu/allergens'
import { useCart } from '@/lib/cart/CartContext'
import { AllergenIcons } from './AllergenIcons'

type Props = {
  item: MenuItem
  brand: ResolvedBrand
  itemNotesEnabled: boolean
}

export function MenuItemCard({ item, brand, itemNotesEnabled }: Props) {
  const t = useTranslations('consumer.menu')
  const tDiet = useTranslations('consumer.menu.dietTags')
  const locale = useLocale() as 'nl' | 'en'
  const [noteOpen, setNoteOpen] = useState(false)

  const { addLine, incrementLine, decrementLine, updateNote, getLine } =
    useCart()
  const line = getLine(item.id)
  const qty = line?.quantity ?? 0
  const note = line?.note ?? ''

  function onIncrement() {
    if (qty === 0) {
      addLine({
        itemId: item.id,
        name: item.name,
        priceCents: item.priceCents,
        vatRateBp: item.vatRateBp,
        quantity: 1,
        note: '',
      })
    } else {
      incrementLine(item.id)
    }
  }

  function onDecrement() {
    decrementLine(item.id)
  }

  function onNoteChange(value: string) {
    updateNote(item.id, value)
  }

  const { allergens, diet } = splitTags(item.dietaryTags)
  const hasPhoto = !!item.photoUrl

  const priceLabel = new Intl.NumberFormat(
    locale === 'en' ? 'en-NL' : 'nl-NL',
    { style: 'currency', currency: 'EUR' }
  ).format(item.priceCents / 100)

  const content = (
    <>
      <p
        style={{
          fontFamily: 'var(--font-jost), sans-serif',
          fontWeight: 600,
          fontSize: '16px',
          lineHeight: 1.3,
          color: 'var(--night, #0f0d08)',
          margin: 0,
        }}
      >
        {item.name}
      </p>
      {item.description ? (
        <p
          style={{
            fontFamily: 'var(--font-jost), sans-serif',
            fontWeight: 400,
            fontSize: '14px',
            lineHeight: 1.5,
            color: 'var(--stone, #7a7264)',
            margin: '4px 0 0 0',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {item.description}
        </p>
      ) : null}

      {diet.length > 0 ? (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            marginTop: '8px',
          }}
        >
          {diet.map((tag) => (
            <span
              key={tag}
              style={{
                padding: '2px 8px',
                borderRadius: '999px',
                background: 'rgba(122, 114, 100, 0.10)',
                color: 'var(--stone, #7a7264)',
                fontFamily: 'var(--font-jost), sans-serif',
                fontSize: '11px',
                fontWeight: 500,
                letterSpacing: '0.04em',
              }}
            >
              {tDiet(tag)}
            </span>
          ))}
        </div>
      ) : null}

      <div style={{ marginTop: '8px' }}>
        <AllergenIcons codes={allergens} />
      </div>

      <p
        style={{
          fontFamily: 'var(--font-jost), sans-serif',
          fontWeight: 700,
          fontSize: '16px',
          color: 'var(--night, #0f0d08)',
          margin: '8px 0 0 0',
        }}
      >
        {priceLabel}
      </p>
    </>
  )

  const action = !item.available ? (
    <span
      style={{
        display: 'block',
        textAlign: 'center',
        padding: '8px 12px',
        borderRadius: '999px',
        background: 'rgba(30, 21, 8, 0.06)',
        color: 'var(--stone, #7a7264)',
        fontFamily: 'var(--font-jost), sans-serif',
        fontWeight: 600,
        fontSize: '13px',
      }}
    >
      {t('unavailable')}
    </span>
  ) : qty === 0 ? (
    <button
      type="button"
      className="tafel-tap"
      onClick={onIncrement}
      style={{
        width: '100%',
        background: brand.primaryHex,
        color: '#fff',
        padding: '8px 16px',
        borderRadius: '999px',
        border: 'none',
        fontFamily: 'var(--font-jost), sans-serif',
        fontWeight: 600,
        fontSize: '14px',
      }}
    >
      {t('add')}
    </button>
  ) : (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        border: `1px solid ${brand.primaryHex}`,
        borderRadius: '999px',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        className="tafel-tap"
        onClick={onDecrement}
        aria-label="-"
        style={{
          border: 'none',
          background: 'transparent',
          color: brand.primaryHex,
          fontWeight: 700,
          fontSize: '16px',
          padding: '6px 12px',
        }}
      >
        −
      </button>
      <span
        style={{
          fontFamily: 'var(--font-jost), sans-serif',
          fontWeight: 600,
          fontSize: '14px',
          color: 'var(--night, #0f0d08)',
        }}
      >
        {qty}
      </span>
      <button
        type="button"
        className="tafel-tap"
        onClick={onIncrement}
        aria-label="+"
        style={{
          border: 'none',
          background: 'transparent',
          color: brand.primaryHex,
          fontWeight: 700,
          fontSize: '16px',
          padding: '6px 12px',
        }}
      >
        +
      </button>
    </div>
  )

  return (
    <div style={{ opacity: item.available ? 1 : 0.55 }}>
      <div
        style={{
          padding: '16px 0',
          borderBottom: '1px solid rgba(30, 21, 8, 0.06)',
        }}
      >
        {hasPhoto ? (
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>{content}</div>
            <div
              style={{
                width: '96px',
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.photoUrl!}
                alt=""
                style={{
                  width: '100%',
                  aspectRatio: '1',
                  borderRadius: '12px',
                  objectFit: 'cover',
                  background: 'rgba(30, 21, 8, 0.04)',
                }}
              />
              {action}
            </div>
          </div>
        ) : (
          <div>
            {content}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginTop: '12px',
              }}
            >
              <div style={{ width: '136px' }}>{action}</div>
            </div>
          </div>
        )}
      </div>

      {itemNotesEnabled && qty > 0 ? (
        <div style={{ padding: '0 0 12px 0' }}>
          {noteOpen ? (
            <>
              <textarea
                value={note}
                maxLength={140}
                placeholder={t('notePlaceholder')}
                onChange={(e) => onNoteChange(e.target.value)}
                style={{
                  width: '100%',
                  fontFamily: 'var(--font-jost), sans-serif',
                  fontWeight: 400,
                  fontSize: '14px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(30, 21, 8, 0.15)',
                  resize: 'vertical',
                  minHeight: '44px',
                }}
              />
              <button
                type="button"
                className="tafel-tap"
                onClick={() => {
                  setNoteOpen(false)
                  onNoteChange('')
                }}
                style={{
                  marginTop: '4px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--stone, #7a7264)',
                  fontFamily: 'var(--font-jost), sans-serif',
                  fontSize: '13px',
                  padding: 0,
                }}
              >
                {t('removeNote')}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="tafel-tap"
              onClick={() => setNoteOpen(true)}
              style={{
                border: 'none',
                background: 'transparent',
                color: brand.primaryHex,
                fontFamily: 'var(--font-jost), sans-serif',
                fontWeight: 600,
                fontSize: '13px',
                padding: 0,
              }}
            >
              {t('addNote')}
            </button>
          )}
        </div>
      ) : null}
    </div>
  )
}
