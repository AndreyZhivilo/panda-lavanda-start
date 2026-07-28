import { describe, expect, it } from 'vitest'

import type { ICart } from './cart'
import {
  cartDistinctItemCount,
  cartItemQuantity,
  cartSubtotal,
  cartTotalQuantity,
  isInCart,
} from './cart'

const cart: ICart = {
  items: [
    { exemplarId: 'e1', productId: 'p1', quantity: 2 },
    { exemplarId: 'e2', productId: 'p1', quantity: 1 },
    { exemplarId: 'e3', productId: 'p2', quantity: 3 },
  ],
}

describe('isInCart', () => {
  it('returns true for an exemplar that is in the cart', () => {
    expect(isInCart(cart, 'e1')).toBe(true)
    expect(isInCart(cart, 'e3')).toBe(true)
  })

  it('returns false for an exemplar that is not in the cart', () => {
    expect(isInCart(cart, 'eX')).toBe(false)
  })

  it('returns false for an empty cart', () => {
    expect(isInCart({ items: [] }, 'e1')).toBe(false)
  })
})

describe('cartItemQuantity', () => {
  it('returns the quantity for an exemplar in the cart', () => {
    expect(cartItemQuantity(cart, 'e1')).toBe(2)
    expect(cartItemQuantity(cart, 'e3')).toBe(3)
  })

  it('returns 0 for an exemplar not in the cart', () => {
    expect(cartItemQuantity(cart, 'eX')).toBe(0)
  })
})

describe('cartTotalQuantity', () => {
  it('sums the quantities of all lines', () => {
    expect(cartTotalQuantity(cart)).toBe(6)
  })

  it('returns 0 for an empty cart', () => {
    expect(cartTotalQuantity({ items: [] })).toBe(0)
  })
})

describe('cartDistinctItemCount', () => {
  it('counts distinct lines (not units)', () => {
    expect(cartDistinctItemCount(cart)).toBe(3)
  })

  it('returns 0 for an empty cart', () => {
    expect(cartDistinctItemCount({ items: [] })).toBe(0)
  })
})

describe('cartSubtotal', () => {
  const prices = new Map<string, number>([
    ['e1', 100],
    ['e2', 250],
    // 'e3' has no price → treated as deleted, skipped
  ])
  const priceOf = (id: string) => prices.get(id)

  it('sums unit price × quantity for every line with a known price', () => {
    // e1: 100 × 2 = 200; e2: 250 × 1 = 250; e3 skipped → 450
    expect(cartSubtotal(cart, priceOf)).toBe(450)
  })

  it('skips lines whose price is unknown (deleted exemplar)', () => {
    expect(cartSubtotal(cart, () => undefined)).toBe(0)
  })

  it('returns 0 for an empty cart', () => {
    expect(cartSubtotal({ items: [] }, priceOf)).toBe(0)
  })

  it('does not mutate the cart', () => {
    const snapshot = cart.items.map((i) => ({ ...i }))
    cartSubtotal(cart, priceOf)
    expect(cart.items).toEqual(snapshot)
  })
})
