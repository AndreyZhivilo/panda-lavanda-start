import type { IProductsRepository } from '@panda-lavanda/domain'
import { DrizzleProductsRepository } from '@panda-lavanda/infrastructure'

import { db } from './db'

/**
 * Composition root for the products repository.
 *
 * This is the only place that knows which concrete products backend the app
 * uses. Everything else depends on the {@link IProductsRepository} port, so
 * swapping to a different implementation later is a change localized here.
 */
export const productsRepository: IProductsRepository =
  new DrizzleProductsRepository(db)
