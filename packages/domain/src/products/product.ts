import type { ImageUrl, PriceInRub, UniqueId } from '@panda-lavanda/shared'

/**
 * Product variant sizes.
 *
 * Implemented as a const object + union type rather than a `const enum`,
 * because `const enum` is incompatible with `isolatedModules` /
 * `verbatimModuleSyntax` (enabled in our tsconfig) when modules are
 * transpiled in isolation. Usage stays ergonomic: `Size.P9`.
 */
export const Size = {
  P9: 'p9',
  P11: 'p11',
} as const

/** Size value — one of the `Size` const keys. */
export type Size = (typeof Size)[keyof typeof Size]

/** A concrete variant of a product: size, price and availability. */
export interface IExemplar {
  id: UniqueId
  price: PriceInRub
  inStock: boolean
  size: Size
}

/** A sellable product with its variants (exemplars). */
export interface IProduct {
  id: UniqueId
  name: string
  description: string
  category: UniqueId
  images: ImageUrl[]
  exemplars: IExemplar[]
}
