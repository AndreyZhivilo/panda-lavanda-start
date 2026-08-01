import type { IOrdersRepository } from '@panda-lavanda/domain'
import { HttpOrdersRepository } from '@panda-lavanda/infrastructure'

import { env } from '#/shared/lib/env.server'

/**
 * Composition root for the orders feature (server side).
 *
 * The only place that knows which concrete orders backend the app uses.
 * Everything else depends on the {@link IOrdersRepository} port, so swapping
 * to a different implementation later is a change localized here.
 *
 * Persistence lives in the dedicated backend service (`apps/api`); this adapter
 * talks to it over HTTP via {@link HttpOrdersRepository}. The backend URL is
 * validated by zod at module scope in `shared/lib/env.server.ts`
 * (`env.BACKEND_URL`).
 *
 * Exports the wired repository only: order creation on the client is
 * orchestrated by `CreateOrderUseCase`, which lives in the **client**
 * composition root (`index.client.ts`) because it also drives the cart and
 * notifications (both client-only side effects). This server-side repository is
 * consumed by the `createOrder` server function (the RPC bridge the client
 * orchestration calls into), matching the convention of {@link ./products.ts}.
 */
export const ordersRepository: IOrdersRepository = new HttpOrdersRepository({
  baseUrl: env.BACKEND_URL,
})
