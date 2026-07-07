'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import type { ResolvedBrand } from '@/lib/consumer/brandTokens'
import { useCart } from '@/lib/cart/CartContext'
import { formatCents } from '@/lib/cart/pricing'

type Props = {
  brand: ResolvedBrand
}

export function CartDrawer({ brand }: Props) {
  const t = useTranslations('consumer.cart.drawer')
  const locale = useLocale() as 'nl' | 'en'
  const {
    cart,
    totals,
    incrementLine,
    decrementLine,
    updateNote,
    clearCart,
    isDrawerOpen,
    closeDrawer,
  } = useCart()

  const [toastVisible, setToastVisible] = useState(false)
  const [noteOpenFor, setNoteOpenFor] = useState<string | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isDrawerOpen) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeDrawer()
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
    // closeDrawer is intentionally omitted: CartContext recreates it on every
    // cart change (e.g. each note keystroke), and including it here re-ran
    // this effect on every keystroke — re-focusing the close button and
    // stealing focus from the note textarea mid-type. closeDrawer always
    // just calls the (permanently stable) setIsDrawerOpen(false) setter, so
    // dropping it from the deps is safe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDrawerOpen])

  if (!isDrawerOpen) return null

  function handleCheckout() {
    setToastVisible(true)
    setTimeout(() => {
      setToastVisible(false)
      closeDrawer()
    }, 2500)
  }

  function handleClearCart() {
    if (window.confirm(t('clearConfirm'))) {
      clearCart()
    }
  }

  return (
    <>
      <div
        onClick={closeDrawer}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(30, 21, 8, 0.4)',
          backdropFilter: 'blur(2px)',
          zIndex: 50,
        }}
      />

      <div
        className="cart-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={t('heading')}
        style={{
          position: 'fixed',
          zIndex: 51,
          background: 'var(--cream, #fdfaf5)',
          padding: '24px 20px 16px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-raleway), serif',
              fontWeight: 900,
              fontSize: '22px',
              color: 'var(--night, #0f0d08)',
              margin: 0,
            }}
          >
            {t('heading')}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeDrawer}
            aria-label={t('close')}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              padding: '4px',
              color: 'var(--night, #0f0d08)',
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {cart.lines.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
              textAlign: 'center',
            }}
          >
            <p
              style={{
                fontFamily: 'var(--font-jost), sans-serif',
                fontWeight: 500,
                fontSize: '16px',
                color: 'var(--stone, #7a7264)',
                margin: 0,
              }}
            >
              {t('emptyStateHeading')}
            </p>
            <button
              type="button"
              onClick={closeDrawer}
              style={{
                background: brand.primaryHex,
                color: '#fff',
                padding: '10px 20px',
                borderRadius: '999px',
                border: 'none',
                fontFamily: 'var(--font-jost), sans-serif',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              {t('backToMenu')}
            </button>
          </div>
        ) : (
          <>
            <div style={{ flex: 1, overflowY: 'auto', marginTop: '16px' }}>
              {cart.lines.map((line) => (
                <div
                  key={line.itemId}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '12px',
                    padding: '14px 0',
                    borderBottom: '1px solid rgba(30, 21, 8, 0.06)',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontFamily: 'var(--font-jost), sans-serif',
                        fontWeight: 600,
                        fontSize: '15px',
                        color: 'var(--night, #0f0d08)',
                        margin: 0,
                      }}
                    >
                      {line.name}
                    </p>

                    {line.note ? (
                      <p
                        style={{
                          fontFamily: 'var(--font-jost), sans-serif',
                          fontWeight: 400,
                          fontStyle: 'italic',
                          fontSize: '13px',
                          color: 'var(--stone, #7a7264)',
                          margin: '2px 0 0 0',
                        }}
                      >
                        {line.note}
                      </p>
                    ) : null}

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        marginTop: '8px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          border: `1px solid ${brand.primaryHex}`,
                          borderRadius: '999px',
                          padding: '2px 4px',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => decrementLine(line.itemId)}
                          aria-label="-"
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: brand.primaryHex,
                            fontWeight: 700,
                            fontSize: '15px',
                            padding: '4px 8px',
                            cursor: 'pointer',
                          }}
                        >
                          −
                        </button>
                        <span
                          style={{
                            fontFamily: 'var(--font-jost), sans-serif',
                            fontWeight: 600,
                            fontSize: '13px',
                            color: 'var(--night, #0f0d08)',
                          }}
                        >
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => incrementLine(line.itemId)}
                          aria-label="+"
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: brand.primaryHex,
                            fontWeight: 700,
                            fontSize: '15px',
                            padding: '4px 8px',
                            cursor: 'pointer',
                          }}
                        >
                          +
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setNoteOpenFor(
                            noteOpenFor === line.itemId ? null : line.itemId
                          )
                        }
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--stone, #7a7264)',
                          fontFamily: 'var(--font-jost), sans-serif',
                          fontSize: '12px',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        {t('editNote')}
                      </button>
                    </div>

                    {noteOpenFor === line.itemId ? (
                      <textarea
                        value={line.note}
                        maxLength={140}
                        onChange={(e) => updateNote(line.itemId, e.target.value)}
                        style={{
                          width: '100%',
                          marginTop: '8px',
                          fontFamily: 'var(--font-jost), sans-serif',
                          fontWeight: 400,
                          fontSize: '13px',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: '1px solid rgba(30, 21, 8, 0.15)',
                          resize: 'vertical',
                          minHeight: '40px',
                        }}
                      />
                    ) : null}
                  </div>

                  <p
                    style={{
                      fontFamily: 'var(--font-jost), sans-serif',
                      fontWeight: 700,
                      fontSize: '15px',
                      color: 'var(--night, #0f0d08)',
                      margin: 0,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatCents(line.priceCents * line.quantity, locale)}
                  </p>
                </div>
              ))}
            </div>

            <div style={{ paddingTop: '16px', borderTop: '1px solid rgba(30, 21, 8, 0.1)' }}>
              <div style={{ textAlign: 'right' }}>
                <p
                  style={{
                    fontFamily: 'var(--font-jost), sans-serif',
                    fontWeight: 700,
                    fontSize: '18px',
                    color: 'var(--night, #0f0d08)',
                    margin: 0,
                  }}
                >
                  {t('totalLabel')} {formatCents(totals.totalCents, locale)}
                </p>
                <p
                  style={{
                    fontFamily: 'var(--font-jost), sans-serif',
                    fontWeight: 400,
                    fontSize: '13px',
                    color: 'var(--stone, #7a7264)',
                    margin: '2px 0 0 0',
                  }}
                >
                  {t('vatBreakdown')} {formatCents(totals.vatCents, locale)}
                </p>
              </div>

              <button
                type="button"
                onClick={handleCheckout}
                style={{
                  width: '100%',
                  marginTop: '20px',
                  background: brand.primaryHex,
                  color: '#fff',
                  padding: '14px 20px',
                  borderRadius: '999px',
                  border: 'none',
                  fontFamily: 'var(--font-jost), sans-serif',
                  fontWeight: 600,
                  fontSize: '15px',
                  cursor: 'pointer',
                }}
              >
                {t('checkoutCta')}
              </button>

              <button
                type="button"
                onClick={handleClearCart}
                style={{
                  display: 'block',
                  margin: '14px auto 0',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--stone, #7a7264)',
                  fontFamily: 'var(--font-jost), sans-serif',
                  fontWeight: 500,
                  fontSize: '13px',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                {t('clearCart')}
              </button>
            </div>
          </>
        )}

        {toastVisible ? (
          <div
            style={{
              position: 'absolute',
              bottom: '16px',
              left: '16px',
              right: '16px',
              background: 'var(--night, #0f0d08)',
              color: '#fff',
              padding: '12px 16px',
              borderRadius: '12px',
              fontFamily: 'var(--font-jost), sans-serif',
              fontSize: '13px',
              textAlign: 'center',
            }}
          >
            {t('checkoutSoonToast')}
          </div>
        ) : null}
      </div>

      <style>{`
        .cart-drawer {
          left: 0;
          right: 0;
          bottom: 0;
          top: auto;
          width: 100%;
          max-height: 88vh;
          border-radius: 20px 20px 0 0;
          animation: slideUp 0.25s ease-out;
        }
        @media (min-width: 640px) {
          .cart-drawer {
            left: auto;
            top: 0;
            bottom: 0;
            right: 0;
            width: 480px;
            max-height: none;
            height: 100%;
            border-radius: 20px 0 0 20px;
            animation: slideIn 0.25s ease-out;
          }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  )
}
