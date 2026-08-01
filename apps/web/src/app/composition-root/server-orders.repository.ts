import {
  ValidationError,
  type CreateOrderData,
  type IOrder,
  type IOrdersRepository,
} from '@panda-lavanda/domain'
import type { UniqueId } from '@panda-lavanda/shared'

import { createOrder } from '#/app/server-functions'

/**
 * RPC-backed implementation of {@link IOrdersRepository} for the **client**.
 *
 * The checkout flow is orchestrated client-side by `CreateOrderUseCase`, which
 * needs an {@link IOrdersRepository}. On the client that repository cannot
 * touch the backend directly the way the server's {@link HttpOrdersRepository}
 * does (it must not read `BACKEND_URL`, and must not pull server-only modules).
 * Instead it calls the {@link createOrder} server function — TanStack Start's
 * compiler turns that call into an RPC fetch, keeping `BACKEND_URL` server-side
 * (the convention used by every other server function in this app).
 *
 * Why this lives in `apps/web` and not in `packages/infrastructure`:
 * `createServerFn` is a TanStack Start concept owned by the web app; the shared
 * infrastructure package must not depend on an app (that would invert the
 * package → app dependency direction, see AGENTS.md). So the RPC adapter is an
 * app-layer composition-root concern, just like `index.client.ts` next to it.
 *
 * The server function returns a plain discriminated union
 * (`{ ok: true, order } | { ok: false, message }`) because `Either` and `Error`
 * do not survive server→client serialization; on the failure branch we throw an
 * `AppError` so the calling use case's `tryCatch` turns it into `Either.Left`,
 * matching how the HTTP repositories surface failures.
 */
export class ServerFnOrdersRepository implements IOrdersRepository {
  async create(data: CreateOrderData): Promise<IOrder> {
    const result = await createOrder({ data })
    if (!result.ok) {
      throw new ValidationError(result.message)
    }
    return result.order
  }

  async getById(_id: UniqueId): Promise<IOrder | null> {
    // Not used by the storefront checkout. Implemented to satisfy the port;
    // a future order-detail page would add its own server function and call it
    // here. Returning null keeps the contract honest rather than pretending.
    return null
  }
}
