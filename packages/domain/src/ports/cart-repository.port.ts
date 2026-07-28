import type { UniqueId } from '@panda-lavanda/shared'

import type { ICart, ICartItem } from '../cart'

/**
 * Read/write the current cart.
 *
 * Concrete implementations live in infrastructure and are injected at the
 * composition root (server or client, depending on the backend). The current
 * app has a single LocalStorage-backed implementation for an anonymous cart; a
 * future authenticated implementation (Drizzle + sessions) will replace it
 * without touching callers.
 *
 * Following the same convention as {@link IUserRepository}: the interface lives
 * in the domain layer; only the app's composition root imports a concrete class
 * that `implements` it. Mutations return the updated {@link ICart}, and the
 * merge/remove logic lives in the repository (the use cases are thin wrappers).
 */
export interface ICartRepository {
  /** The current cart, seeded with an empty cart if absent. */
  get(): Promise<ICart>

  /**
   * Add an item, merging its quantity into an existing line for the same
   * exemplar. Returns the updated cart.
   */
  addItem(item: ICartItem): Promise<ICart>

  /**
   * Remove the line for the given exemplar. Idempotent: removing a missing
   * exemplar succeeds and returns the unchanged cart.
   */
  removeItem(exemplarId: UniqueId): Promise<ICart>

  /**
   * Set the quantity for the given exemplar's line. A quantity of zero or
   * below removes the line. Returns the updated cart.
   */
  setQuantity(exemplarId: UniqueId, quantity: number): Promise<ICart>

  /** Remove every line, returning an empty cart. */
  clear(): Promise<ICart>
}
