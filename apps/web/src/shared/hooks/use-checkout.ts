import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createIsomorphicFn } from '@tanstack/react-start'

import type { CreateOrderData, IOrder } from '@panda-lavanda/domain'

import { createOrderUseCase } from '#/app/composition-root/index.client'
import { CART_QUERY_KEY } from './use-cart'

/**
 * Resolves the client `CreateOrderUseCase` per environment.
 *
 * Same import-protection pattern as {@link useCart} / {@link useFavorites}: the
 * use case is pre-wired in the structurally client-only composition root
 * (`*.client.*`), so a plain top-level import would trip TanStack Start's
 * import-protection during SSR. Wrapping the reference in
 * `createIsomorphicFn().client(...)` places the identifier inside a "compiler
 * safe boundary"; the server build keeps only the `.server(...)` throwing stub,
 * which is never invoked because this hook is only used on an `ssr: false`
 * route.
 */
const resolveUseCases = createIsomorphicFn()
  .client(() => ({ createOrder: createOrderUseCase }))
  .server(() => ({
    createOrder: {
      execute: () => {
        throw new Error('CreateOrderUseCase is client-only.')
      },
    },
  }))

const { createOrder } = resolveUseCases()

/**
 * Places a checkout order from the cart.
 *
 * The use case owns the orchestration: it persists the order, clears the cart
 * in LocalStorage and shows a success toast. The use case operates on the
 * repository directly and so bypasses {@link useCart} — which is the only place
 * the React Query cache for the cart gets invalidated. To keep that cache in
 * sync with the now-empty LocalStorage after a successful order, this hook
 * invalidates the `['cart']` query on success (before any caller navigation),
 * so no subscriber can briefly observe a stale, non-empty cart.
 *
 * The hook is otherwise only the React/Query binding: a `useMutation` that
 * unwraps the `Either` result so a failure surfaces as the mutation's
 * `isError` / `error` state for inline display.
 *
 * ## Post-success navigation
 *
 * The caller may pass an `onSuccess` callback; it runs **after** the internal
 * cache invalidation, fired exactly once when the mutation resolves (not "while
 * a flag is true", which a `useEffect` watching `isSuccess` would approximate).
 * Navigation is a presentation concern — it lives in the checkout page, not in
 * the use case — so the hook does no routing of its own and stays free of a
 * router dependency.
 *
 * @param options.onSuccess Called once with the created order after the cart
 *   cache has been invalidated. Optional.
 */
export function useCheckout(options?: {
  onSuccess?: (order: IOrder) => void
}) {
  const queryClient = useQueryClient()
  const onSuccessCallback = options?.onSuccess

  const mutation = useMutation<IOrder, Error, CreateOrderData>({
    mutationFn: async (data) => (await createOrder.execute(data)).unwrap(),
    // Invalidate only on success: on failure the cart is untouched, so the
    // cache is still correct and a refetch would add nothing. The caller's
    // `onSuccess` runs afterwards so navigation sees a consistent cart state.
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY })
      onSuccessCallback?.(order)
    },
  })

  return {
    placeOrder: (data: CreateOrderData) => mutation.mutate(data),
    isPlacing: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
  }
}
