import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createIsomorphicFn } from '@tanstack/react-start'

import {
  cartDistinctItemCount,
  cartItemQuantity,
  cartTotalQuantity,
  isInCart,
  type ICart,
  type ICartItem,
} from '@panda-lavanda/domain'
import type { UniqueId } from '@panda-lavanda/shared'

import {
  addCartItemUseCase,
  clearCartUseCase,
  getCartUseCase,
  removeCartItemUseCase,
  setCartQuantityUseCase,
} from '#/app/composition-root/index.client'

/**
 * Query key for the current cart.
 *
 * Shared between {@link useCart} reads and invalidations so every component
 * subscribed to the cart re-renders after a mutation.
 */
export const CART_QUERY_KEY = ['cart'] as const

/**
 * Resolves the client use cases per environment.
 *
 * The use cases come pre-wired from the client composition root, but that
 * module is a structurally client-only (`*.client.*`) file. This hook renders
 * during SSR, so a plain top level `import` + use would let the server bundle
 * see the `index.client` import and trip TanStack Start's import-protection.
 *
 * Wrapping the reference in `createIsomorphicFn().client(...)` places the cart
 * use case identifiers inside a "compiler safe boundary": import-protection
 * does not flag them in the server bundle, and the server build keeps only the
 * `.server(...)` branch (inert throwing stubs). The stubs are never invoked,
 * because TanStack Query does not run the `queryFn` for this key during SSR.
 *
 * (The use cases themselves are plain instances exported from the composition
 * root; they are NOT isomorphic fns. The `createIsomorphicFn` here exists only
 * to satisfy import-protection at this module's boundary - it does not branch
 * environment in the use cases, it just picks real-vs-stub at this call site.)
 */
const resolveUseCases = createIsomorphicFn()
  .client(() => ({
    getCart: getCartUseCase,
    addCartItem: addCartItemUseCase,
    removeCartItem: removeCartItemUseCase,
    setCartQuantity: setCartQuantityUseCase,
    clearCart: clearCartUseCase,
  }))
  .server(() => ({
    getCart: { execute: () => { throw new Error('GetCartUseCase is client-only (LocalStorage-backed).') } },
    addCartItem: { execute: () => { throw new Error('AddCartItemUseCase is client-only (LocalStorage-backed).') } },
    removeCartItem: { execute: () => { throw new Error('RemoveCartItemUseCase is client-only (LocalStorage-backed).') } },
    setCartQuantity: { execute: () => { throw new Error('SetCartQuantityUseCase is client-only (LocalStorage-backed).') } },
    clearCart: { execute: () => { throw new Error('ClearCartUseCase is client-only (LocalStorage-backed).') } },
  }))

// Build the use cases ONCE at module load, not per hook call. The use cases
// are stateless wrappers over the (singleton) repository, so a single shared
// instance is correct and cheaper than re-allocating on every render. On the
// server this resolves to the inert throwing stubs above, which are never
// invoked during SSR.
const { getCart, addCartItem, removeCartItem, setCartQuantity, clearCart } =
  resolveUseCases()

/**
 * Client-side cart state.
 *
 * Wraps the cart repository in TanStack Query so the cart is cached and shared.
 * Each mutation invalidates the ['cart'] query, which makes every cart-bound
 * component re-render automatically - the optimistic-rendering benefit we
 * wanted from Query.
 *
 * The query functions (`isInCart`, `quantity`, etc.) are backed by the pure
 * domain functions from `@panda-lavanda/domain`; while the cart is still
 * loading (before LocalStorage is read on first client paint) they return
 * false / zero defaults.
 */
export function useCart() {
  const queryClient = useQueryClient()

  const { data: cart, isLoading } = useQuery<ICart>({
    queryKey: CART_QUERY_KEY,
    // Use cases return Either<Error, T> and never throw across layer
    // boundaries. .unwrap() is the boundary where a Left becomes a thrown
    // error for TanStack Query to observe as an error state: on a Right it
    // returns the value, on a Left it throws the Error.
    queryFn: async () => (await getCart.execute()).unwrap(),
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY })

  const addMutation = useMutation({
    mutationFn: async (item: ICartItem) =>
      (await addCartItem.execute(item)).unwrap(),
    // Invalidate on settle (not success) so a failed add still re-syncs the
    // cache from LocalStorage rather than holding a stale view.
    onSettled: invalidate,
  })

  const removeMutation = useMutation({
    mutationFn: async (exemplarId: UniqueId) =>
      (await removeCartItem.execute(exemplarId)).unwrap(),
    onSettled: invalidate,
  })

  const setQuantityMutation = useMutation({
    mutationFn: async ({ exemplarId, quantity }: { exemplarId: UniqueId; quantity: number }) =>
      (await setCartQuantity.execute(exemplarId, quantity)).unwrap(),
    onSettled: invalidate,
  })

  const clearMutation = useMutation({
    mutationFn: async () => (await clearCart.execute()).unwrap(),
    onSettled: invalidate,
  })

  const items = cart?.items ?? []

  return {
    cart,
    items,
    isLoading,
    addItem: (item: ICartItem) => addMutation.mutate(item),
    removeItem: (exemplarId: UniqueId) => removeMutation.mutate(exemplarId),
    setQuantity: (exemplarId: UniqueId, quantity: number) =>
      setQuantityMutation.mutate({ exemplarId, quantity }),
    clear: () => clearMutation.mutate(),
    isPending:
      addMutation.isPending ||
      removeMutation.isPending ||
      setQuantityMutation.isPending ||
      clearMutation.isPending,
    // Derived reads backed by pure domain functions.
    isInCart: (exemplarId: UniqueId): boolean =>
      cart ? isInCart(cart, exemplarId) : false,
    quantity: (exemplarId: UniqueId): number =>
      cart ? cartItemQuantity(cart, exemplarId) : 0,
    totalQuantity: cart ? cartTotalQuantity(cart) : 0,
    itemCount: cart ? cartDistinctItemCount(cart) : 0,
  }
}
