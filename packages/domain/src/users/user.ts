import type { UniqueId } from '@panda-lavanda/shared'

/**
 * Authenticated or anonymous user.
 *
 * Until real authentication exists, the web app owns exactly one anonymous
 * `IUser` whose `favoriteProductIds` are persisted in browser LocalStorage
 * (see `LocalStorageUserRepository` in infrastructure). A future server-backed
 * implementation will replace it without touching callers, because every
 * layer above depends on this interface, not on the storage mechanism.
 */
export interface IUser {
  id: UniqueId
  favoriteProductIds: UniqueId[]
}

/**
 * Whether a product is in the user's favorites.
 *
 * Pure function over the {@link IUser} value — no I/O, no framework deps.
 * Lives in the domain layer so the rule has a single, testable definition;
 * components and hooks read the cached user (e.g. via TanStack Query) and
 * call this, instead of re-implementing the `includes` check at each
 * call site.
 */
export function isFavoriteProduct(user: IUser, productId: UniqueId): boolean {
  return user.favoriteProductIds.includes(productId)
}
