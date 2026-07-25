import { GetProductsUseCase } from '@panda-lavanda/application'
import type { IProductsRepository } from '@panda-lavanda/domain'
import { HttpProductsRepository } from '@panda-lavanda/infrastructure'

import { env } from '#/shared/lib/env.server'

/**
 * Composition root for the products feature.
 *
 * The only place that knows which concrete products backend the app uses.
 * Everything else depends on the {@link IProductsRepository} port (or the
 * {@link GetProductsUseCase} built from it), so swapping to a different
 * implementation later is a change localized here.
 *
 * Persistence lives in the dedicated backend service (`apps/api`); this adapter
 * talks to it over HTTP via {@link HttpProductsRepository}. The backend URL is
 * validated by zod at module scope in `shared/lib/env.server.ts`
 * (`env.BACKEND_URL`).
 *
 * Exports both the wired repository and the ready-made use case so consumers
 * (server functions) never instantiate use cases themselves - matching the
 * convention used by {@link ./index.client.ts} on the client side.
 */
export const productsRepository: IProductsRepository =
  new HttpProductsRepository({ baseUrl: env.BACKEND_URL })

export const getProductsUseCase = new GetProductsUseCase(productsRepository)
