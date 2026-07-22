import type { UniqueId } from '@panda-lavanda/shared'

import type { IUser } from '../users'

/**
 * Read/write the current user.
 *
 * Concrete implementations live in infrastructure and are injected at the
 * composition root (server or client, depending on the backend). The current
 * app has a single LocalStorage-backed implementation for anonymous
 * favorites; a future authenticated implementation (Drizzle + sessions) will
 * replace it without touching callers.
 *
 * Following the same convention as {@link IProductsRepository}: the interface
 * lives in the domain layer; only the app's composition root imports a
 * concrete class that `implements` it.
 */
export interface IUserRepository {
  /** The current user, seeded with an empty favorites list if absent. */
  getCurrent(): Promise<IUser>

  /**
   * Add the product to favorites if absent, remove it if present.
   * Returns the updated user.
   */
  toggleFavoriteProduct(productId: UniqueId): Promise<IUser>
}
