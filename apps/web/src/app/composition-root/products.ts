import { GetProductsUseCase } from '@panda-lavanda/application'
import type { IProductsRepository } from '@panda-lavanda/domain'
import { DrizzleProductsRepository } from '@panda-lavanda/infrastructure'

import { db } from './db'

/**
 * Composition root for the products feature.
 *
 * The only place that knows which concrete products backend the app uses.
 * Everything else depends on the {@link IProductsRepository} port (or the
 * {@link GetProductsUseCase} built from it), so swapping to a different
 * implementation later is a change localized here.
 *
 * Exports both the wired repository and the ready-made use case so consumers
 * (server functions) never instantiate use cases themselves - matching the
 * convention used by {@link ./index.client.ts} on the client side.
 */
export const productsRepository: IProductsRepository =
  new DrizzleProductsRepository(db)

export const getProductsUseCase = new GetProductsUseCase(productsRepository)
