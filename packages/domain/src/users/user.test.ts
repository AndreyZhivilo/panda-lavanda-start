import { describe, expect, it } from 'vitest'

import type { IUser } from './user'
import { isFavoriteProduct } from './user'

describe('isFavoriteProduct', () => {
  const user: IUser = {
    id: 'user-1',
    favoriteProductIds: ['p1', 'p2'],
  }

  it('returns true when the product id is in the favorites list', () => {
    expect(isFavoriteProduct(user, 'p1')).toBe(true)
    expect(isFavoriteProduct(user, 'p2')).toBe(true)
  })

  it('returns false when the product id is not in the favorites list', () => {
    expect(isFavoriteProduct(user, 'p3')).toBe(false)
  })

  it('returns false when the favorites list is empty', () => {
    const empty: IUser = { id: 'user-1', favoriteProductIds: [] }
    expect(isFavoriteProduct(empty, 'p1')).toBe(false)
  })

  it('does not mutate the user', () => {
    const snapshot = [...user.favoriteProductIds]
    isFavoriteProduct(user, 'p1')
    expect(user.favoriteProductIds).toEqual(snapshot)
  })
})
