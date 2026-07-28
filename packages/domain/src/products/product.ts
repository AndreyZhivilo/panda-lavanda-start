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
  /**
   * URL-friendly identifier, auto-derived from {@link name} via
   * transliteration at creation time. Unique across products and used as the
   * public URL segment (`/products/$productSlug`). Fixed once created: renaming
   * the product does not change the slug, so existing links stay valid.
   */
  slug: string
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

/**
 * The "primary" exemplar of a product — the first in-stock exemplar, or the
 * first exemplar if none are in stock, or `undefined` when the product has no
 * exemplars at all.
 *
 * Pure function over the {@link IProduct} value. Used as the default selection
 * when adding to the cart from a context where the shopper has not yet chosen a
 * size (e.g. a product card in the catalog grid).
 */
export function primaryExemplar(product: IProduct): IExemplar | undefined {
  return product.exemplars.find((e) => e.inStock) ?? product.exemplars[0]
}

/**
 * Human-readable label for a {@link Size} value.
 *
 * Pure function over the {@link Size} value. Lives in the domain layer so the
 * label has a single, consistent definition shared by the exemplar selector,
 * the cart page and anywhere else a size is rendered.
 */
export function sizeLabel(size: Size): string {
  switch (size) {
    case Size.P9:
      return 'P9'
    case Size.P11:
      return 'P11'
    default:
      return size
  }
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
   * Search query: filters products by name (case-insensitive, substring
   * match). The repository ignores empty/whitespace-only values.
   */
  search?: string
  /**
   * Sort keys to apply, in order of precedence (leftmost = primary).
   * Unknown keys are ignored by the repository.
   */
  sort?: SortOrder[]
}
