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

/**
 * Sort keys for product lists.
 *
 * Implemented as a const object + union type rather than a `const enum`,
 * because `const enum` is incompatible with `isolatedModules` /
 * `verbatimModuleSyntax` (enabled in our tsconfig) when modules are
 * transpiled in isolation. Usage stays ergonomic: `SortOrder.OUT_OF_STOCK_LAST`.
 *
 * New keys can be added here without changing `IProductFilters` (which takes
 * `SortOrder[]`), so the contract is forward-compatible with future sort
 * options (by price, name, popularity, …).
 */
export const SortOrder = {
  /** Products with no exemplar in stock sink to the end of the list. */
  OUT_OF_STOCK_LAST: 'out-of-stock-last',
} as const

/** Sort key — one of the `SortOrder` const keys. */
export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]

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

/**
 * Smallest exemplar price, or `null` when the product has no exemplars.
 *
 * Pure function over the {@link IProduct} value — no I/O, no framework deps.
 * Lives in the domain layer so the rule has a single, testable definition;
 * consumers (catalog, favorites, cart, filters, etc.) call this instead of
 * reaching into the `exemplars` array at each call site.
 */
export function minPrice(product: IProduct): PriceInRub | null {
  if (product.exemplars.length === 0) return null
  return Math.min(...product.exemplars.map((e) => e.price))
}

/**
 * A product is in stock if at least one exemplar is in stock.
 *
 * Pure function over the {@link IProduct} value — see {@link minPrice} for the
 * rationale of keeping it in the domain layer.
 */
export function isInStock(product: IProduct): boolean {
  return product.exemplars.some((e) => e.inStock)
}

/** Filters for querying a list of products. */
export interface IProductFilters {
  /** Filter by category. */
  categoryId?: UniqueId
  /** Page number for pagination (1-based). */
  page?: number
  /** Page size (number of items per page). Defaults to the repository's value when omitted. */
  pageSize?: number
  /** Restrict to a specific set of product ids. */
  ids?: UniqueId[]
  /**
   * Sort keys to apply, in order of precedence (leftmost = primary).
   * Unknown keys are ignored by the repository.
   */
  sort?: SortOrder[]
}
