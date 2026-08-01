import { createServerFn } from '@tanstack/react-start'

import { createOrderDataSchema } from '@panda-lavanda/shared'

import { ordersRepository } from '#/app/composition-root'

/**
 * Persists a checkout order on the server.
 *
 * This is a **thin persist-only** server function: it delegates the write to the
 * HTTP-backed {@link ordersRepository} (→ `apps/api` `POST /orders`). The
 * checkout *orchestration* (clear the cart, show a success toast) is owned by
 * the client-side `CreateOrderUseCase`, which calls this function via an RPC
 * adapter — keeping those client-only side effects out of the server bundle.
 *
 * ## Validation
 *
 * Input is validated with {@link createOrderDataSchema} — the **single source
 * of truth** shared with the checkout form and the API route (see
 * `@panda-lavanda/shared/validation/order.ts`). This server-side `.validator`
 * is the authoritative check; the form's live feedback uses the same schema's
 * primitives, so the two cannot drift. A validation failure throws a
 * `ZodError`, which TanStack Start surfaces to the client.
 *
 * As a `.functions.ts` file, this export is safe to import statically from
 * anywhere (routes, components) — TanStack Start's compiler replaces the call
 * with an RPC fetch in the client bundle; only the server keeps the real
 * handler body.
 */
export const createOrder = createServerFn({ method: 'POST' })
  .validator(createOrderDataSchema)
  .handler(async ({ data }) => {
    // The HTTP repository throws an `AppError` on failure (mapped from the
    // backend status code by `HttpRepository`). Catch it here and fold it into
    // the same plain discriminated union shape the other server functions use
    // (e.g. `getProducts`), so the client receives `{ ok, … }` instead of a
    // serialized `Error`.
    try {
      const order = await ordersRepository.create(data)
      return { ok: true as const, order }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Не удалось оформить заказ'
      return { ok: false as const, message }
    }
  })
