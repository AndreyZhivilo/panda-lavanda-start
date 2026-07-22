import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  GetCurrentUserUseCase,
  ToggleFavoriteProductUseCase,
} from '@panda-lavanda/application'
import { isFavoriteProduct, type IUser } from '@panda-lavanda/domain'
import type { UniqueId } from '@panda-lavanda/shared'

import { userRepository } from '#/app/composition-root/index.client'

/**
 * Query key for the current user (the owner of the favorites list).
 *
 * Shared between {@link useFavorites} reads and invalidations so every
 * component subscribed to the user re-renders after a toggle.
 */
const USER_QUERY_KEY = ['user'] as const

const getCurrentUser = new GetCurrentUserUseCase(userRepository)
const toggleFavoriteProduct = new ToggleFavoriteProductUseCase(userRepository)

/**
 * Client-side favorites state.
 *
 * Wraps the user repository in TanStack Query so the favorites list is cached
 * and shared. The toggle is a mutation that invalidates the `['user']` query,
 * which makes every heart icon on the page re-render automatically — the
 * optimistic-rendering benefit we wanted from Query.
 *
 * Returns `isFavorite(id)` backed by the pure domain function
 * {@link isFavoriteProduct}; while the user is still loading (before
 * LocalStorage is read on first client paint), `isFavorite` returns `false`.
 */
export function useFavorites() {
  const queryClient = useQueryClient()

  const { data: user, isLoading } = useQuery<IUser>({
    queryKey: USER_QUERY_KEY,
    // Use cases return `Either<Error, T>` and never throw across layer
    // boundaries. `.unwrap()` is the boundary where a Left becomes a thrown
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
