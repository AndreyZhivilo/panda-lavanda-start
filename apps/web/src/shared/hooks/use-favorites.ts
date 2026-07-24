import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createIsomorphicFn } from '@tanstack/react-start'

import { isFavoriteProduct, type IUser } from '@panda-lavanda/domain'
import type { UniqueId } from '@panda-lavanda/shared'

import {
  getCurrentUserUseCase,
  toggleFavoriteProductUseCase,
} from '#/app/composition-root/index.client'

/**
 * Query key for the current user (the owner of the favorites list).
 *
 * Shared between {@link useFavorites} reads and invalidations so every
 * component subscribed to the user re-renders after a toggle.
 */
const USER_QUERY_KEY = ['user'] as const

/**
 * Resolves the client use cases per environment.
 *
 * The use cases come pre-wired from the client composition root, but that
 * module is a structurally client-only (`*.client.*`) file. This hook renders
 * during SSR, so a plain top-level `import` + use would let the server bundle
 * see the `index.client` import and trip TanStack Start's import-protection.
 *
 * Wrapping the reference in `createIsomorphicFn().client(...)` places the
 * `getCurrentUserUseCase` / `toggleFavoriteProductUseCase` identifiers inside
 * a "compiler safe boundary": import-protection does not flag them in the
 * server bundle, and the server build keeps only the `.server(...)` branch
 * (inert throwing stubs). The stubs are never invoked, because TanStack Query
 * does not run the `queryFn` for these keys during SSR.
 *
 * (The use cases themselves are plain instances exported from the composition
 * root; they are NOT isomorphic fns. The `createIsomorphicFn` here exists only
 * to satisfy import-protection at this module's boundary - it does not branch
 * environment in the use cases, it just picks real-vs-stub at this call site.)
 */
const resolveUseCases = createIsomorphicFn()
  .client(() => ({ getCurrentUser: getCurrentUserUseCase, toggleFavoriteProduct: toggleFavoriteProductUseCase }))
  .server(() => ({
    getCurrentUser: {
      execute: () => {
        throw new Error(
          'GetCurrentUserUseCase is client-only (LocalStorage-backed).',
        )
      },
    },
    toggleFavoriteProduct: {
      execute: () => {
        throw new Error(
          'ToggleFavoriteProductUseCase is client-only (LocalStorage-backed).',
        )
      },
    },
  }))

// Build the use cases ONCE at module load, not per hook call. The use cases
// are stateless wrappers over the (singleton) repository, so a single shared
// instance is correct and cheaper than re-allocating on every render. On the
// server this resolves to the inert throwing stubs above, which are never
// invoked during SSR.
const { getCurrentUser, toggleFavoriteProduct } = resolveUseCases()

/**
 * Client-side favorites state.
 *
 * Wraps the user repository in TanStack Query so the favorites list is cached
 * and shared. The toggle is a mutation that invalidates the ['user'] query,
 * which makes every heart icon on the page re-render automatically - the
 * optimistic-rendering benefit we wanted from Query.
 *
 * Returns isFavorite(id) backed by the pure domain function
 * {@link isFavoriteProduct}; while the user is still loading (before
 * LocalStorage is read on first client paint), isFavorite returns false.
 */
export function useFavorites() {
  const queryClient = useQueryClient()

  const { data: user, isLoading } = useQuery<IUser>({
    queryKey: USER_QUERY_KEY,
    // Use cases return Either<Error, T> and never throw across layer
    // boundaries. .unwrap() is the boundary where a Left becomes a thrown
    // error for TanStack Query to observe as an error state: on a Right it
    // returns the value, on a Left it throws the Error.
    queryFn: async () => (await getCurrentUser.execute()).unwrap(),
  })

  const mutation = useMutation({
    mutationFn: async (productId: UniqueId) =>
      (await toggleFavoriteProduct.execute(productId)).unwrap(),
    // Invalidate on settle (not success) so a failed toggle still re-syncs
    // the cache from LocalStorage rather than holding a stale view.
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEY }),
  })

  return {
    user,
    isLoading,
    isFavorite: (productId: UniqueId): boolean =>
      user ? isFavoriteProduct(user, productId) : false,
    toggle: (productId: UniqueId) => mutation.mutate(productId),
    isToggling: mutation.isPending,
  }
}
