'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from 'react'
import type {
  Cart,
  CartContext as CartContextName,
  CartLine,
  CartTotals,
} from './types'
import { computeTotals } from './pricing'

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

type Action =
  | { type: 'HYDRATE'; cart: Cart }
  | { type: 'ADD'; line: CartLine }
  | { type: 'INCREMENT'; itemId: string }
  | { type: 'DECREMENT'; itemId: string }
  | { type: 'REMOVE'; itemId: string }
  | { type: 'UPDATE_NOTE'; itemId: string; note: string }
  | { type: 'CLEAR' }

function reducer(state: Cart, action: Action): Cart {
  switch (action.type) {
    case 'HYDRATE':
      return action.cart
    case 'ADD': {
      const existing = state.lines.find((l) => l.itemId === action.line.itemId)
      const lines = existing
        ? state.lines.map((l) =>
            l.itemId === action.line.itemId
              ? { ...l, quantity: l.quantity + action.line.quantity }
              : l
          )
        : [...state.lines, action.line]
      return { ...state, lines, updatedAt: Date.now() }
    }
    case 'INCREMENT': {
      const lines = state.lines.map((l) =>
        l.itemId === action.itemId ? { ...l, quantity: l.quantity + 1 } : l
      )
      return { ...state, lines, updatedAt: Date.now() }
    }
    case 'DECREMENT': {
      const lines = state.lines
        .map((l) =>
          l.itemId === action.itemId ? { ...l, quantity: l.quantity - 1 } : l
        )
        .filter((l) => l.quantity > 0)
      return { ...state, lines, updatedAt: Date.now() }
    }
    case 'REMOVE': {
      const lines = state.lines.filter((l) => l.itemId !== action.itemId)
      return { ...state, lines, updatedAt: Date.now() }
    }
    case 'UPDATE_NOTE': {
      const lines = state.lines.map((l) =>
        l.itemId === action.itemId ? { ...l, note: action.note } : l
      )
      return { ...state, lines, updatedAt: Date.now() }
    }
    case 'CLEAR':
      return { ...state, lines: [], updatedAt: Date.now() }
    default:
      return state
  }
}

function storageKey(slug: string, context: CartContextName): string {
  return `tafel:cart:v1:${slug}:${context}`
}

type CartApi = {
  cart: Cart
  totals: CartTotals
  addLine: (line: CartLine) => void
  incrementLine: (itemId: string) => void
  decrementLine: (itemId: string) => void
  removeLine: (itemId: string) => void
  updateNote: (itemId: string, note: string) => void
  clearCart: () => void
  getLine: (itemId: string) => CartLine | undefined
  isDrawerOpen: boolean
  openDrawer: () => void
  closeDrawer: () => void
}

const Ctx = createContext<CartApi | null>(null)

type Props = {
  slug: string
  context: CartContextName
  restaurantId: string
  tableId: string | null
  qrToken: string | null
  children: ReactNode
}

/**
 * Cart state scoped by (slug, context) — separate restaurants and separate
 * ordering contexts (QR vs takeaway) never share a cart. Persists to
 * localStorage and auto-clears after 24h of inactivity.
 */
export function CartProvider({
  slug,
  context,
  restaurantId,
  tableId,
  qrToken,
  children,
}: Props) {
  const [cart, dispatch] = useReducer(reducer, {
    slug,
    context,
    restaurantId,
    tableId,
    qrToken,
    lines: [],
    updatedAt: Date.now(),
  })
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const key = storageKey(slug, context)
    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) return
      const parsed = JSON.parse(raw) as Cart
      if (Date.now() - parsed.updatedAt < TWENTY_FOUR_HOURS_MS) {
        dispatch({
          type: 'HYDRATE',
          cart: { ...parsed, restaurantId, tableId, qrToken },
        })
      } else {
        window.localStorage.removeItem(key)
      }
    } catch {
      // localStorage unavailable (Safari private mode) — start empty.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(storageKey(slug, context), JSON.stringify(cart))
    } catch {
      // ignore write failures
    }
  }, [cart, slug, context])

  const addLine = useCallback((line: CartLine) => {
    dispatch({ type: 'ADD', line })
  }, [])
  const incrementLine = useCallback((itemId: string) => {
    dispatch({ type: 'INCREMENT', itemId })
  }, [])
  const decrementLine = useCallback((itemId: string) => {
    dispatch({ type: 'DECREMENT', itemId })
  }, [])
  const removeLine = useCallback((itemId: string) => {
    dispatch({ type: 'REMOVE', itemId })
  }, [])
  const updateNote = useCallback((itemId: string, note: string) => {
    dispatch({ type: 'UPDATE_NOTE', itemId, note })
  }, [])
  const clearCart = useCallback(() => {
    dispatch({ type: 'CLEAR' })
  }, [])
  const getLine = useCallback(
    (itemId: string) => cart.lines.find((l) => l.itemId === itemId),
    [cart.lines]
  )

  const totals = useMemo(() => computeTotals(cart), [cart])

  const value = useMemo<CartApi>(
    () => ({
      cart,
      totals,
      addLine,
      incrementLine,
      decrementLine,
      removeLine,
      updateNote,
      clearCart,
      getLine,
      isDrawerOpen,
      openDrawer: () => setIsDrawerOpen(true),
      closeDrawer: () => setIsDrawerOpen(false),
    }),
    [
      cart,
      totals,
      addLine,
      incrementLine,
      decrementLine,
      removeLine,
      updateNote,
      clearCart,
      getLine,
      isDrawerOpen,
    ]
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCart(): CartApi {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useCart must be used within a CartProvider')
  return ctx
}
