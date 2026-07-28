import type { PriceInRub, UniqueId } from '@panda-lavanda/shared'

/**
 * A single line in the cart.
 *
 * The line is keyed by the **exemplar** (the concrete variant: size + price),
 * not by the product. A product can have several exemplars (e.g. `P9` and
 * `P11`) with different prices, and a shopper can keep both as separate lines.
 * This mirrors how real shops (Ozon, Wildberries, Shopify) model a cart around
 * a variant/SKU rather than the product template. See {@link IExemplar}.
 *
 * No price/name/image snapshot is stored: those are always read fresh from the
 * backend (the cart is resolved against products loaded by id, like favorites).
 * Keeping the line minimal avoids stale prices and "ghost" rows for deleted
 * products.
 */
export interface ICartItem {
  /** The concrete variant the shopper added (see {@link IExemplar.id}). */
  exemplarId: UniqueId
  /** The product the exemplar belongs to (used to resolve product details). */
  productId: UniqueId
  /** How many units of this exemplar are in the cart (positive integer). */
  quantity: number
}

/**
 * Anonymous cart — an ordered list of {@link ICartItem}.
 *
 * Until authentication exists, the web app owns exactly one anonymous cart
 * persisted in browser LocalStorage (see `LocalStorageCartRepository` in
 * infrastructure). A future server-backed cart (Drizzle + sessions) will
 * replace it without touching callers.
 */
export interface ICart {
  items: ICartItem[]
}

/**
 * Whether the given exemplar is already in the cart.
 *
 * Pure function over the {@link ICart} value — no I/O, no framework deps.
 */
export function isInCart(cart: ICart, exemplarId: UniqueId): boolean {
  return cart.items.some((item) => item.exemplarId === exemplarId)
}

/**
 * Quantity of the given exemplar in the cart, or `0` if it is absent.
 *
 * Pure function over the {@link ICart} value.
 */
export function cartItemQuantity(cart: ICart, exemplarId: UniqueId): number {
  return cart.items.find((item) => item.exemplarId === exemplarId)?.quantity ?? 0
}

/**
 * Total number of units across all lines (sum of quantities).
 *
 * Pure function over the {@link ICart} value — use this for a cart badge count.
 */
export function cartTotalQuantity(cart: ICart): number {
  return cart.items.reduce((sum, item) => sum + item.quantity, 0)
}

/**
 * Number of distinct lines in the cart (not units).
 *
 * Pure function over the {@link ICart} value.
 */
export function cartDistinctItemCount(cart: ICart): number {
  return cart.items.length
}

/**
 * Sum of line prices for the cart.
 *
 * Prices are not stored on {@link ICartItem}; they live on the exemplars. The
 * caller passes a `priceOf` resolver that maps an exemplar id to its current
 * price (built from products loaded fresh from the backend). Lines whose price
 * is unknown (exemplar deleted) are skipped, so a removed product never corrupts
 * the total.
 *
 * Pure function over the {@link ICart} value plus the supplied resolver.
 */
export function cartSubtotal(
  cart: ICart,
  priceOf: (exemplarId: UniqueId) => PriceInRub | undefined,
): PriceInRub {
  return cart.items.reduce((sum, item) => {
    const unitPrice = priceOf(item.exemplarId)
    if (unitPrice === undefined) return sum
    return sum + unitPrice * item.quantity
  }, 0)
}
