import type { Either } from '@sweet-monads/either'

import type {
  ICrashReporterService,
  IProduct,
  IProductsRepository,
  UpdateProductData,
} from '@panda-lavanda/domain'
import type { UniqueId } from '@panda-lavanda/shared'
import { tryCatch } from '@panda-lavanda/shared'

/**
 * Updates an existing product (partial update).
 *
 * Application-layer use case wrapping {@link IProductsRepository.update}: it
 * delegates the write to the repository and converts any thrown error into an
 * `Either.Left`. A `null` result (product not found) is returned as
 * `Either.Right<null>` so the caller can distinguish "missing" from "errored"
 * and render an appropriate message.
 *
 * Note: passing `exemplars` is a **full replacement** of the product's variants
 * (see {@link UpdateProductData}); for a single variant's price/stock change,
 * prefer the exemplar-level use case to keep exemplar ids stable.
 */
export class UpdateProductUseCase {
  constructor(
    private readonly products: IProductsRepository,
    private readonly crashReporter?: ICrashReporterService,
  ) {}

  execute(
    id: UniqueId,
    data: UpdateProductData,
  ): Promise<Either<Error, IProduct | null>> {
    return tryCatch(() => this.products.update(id, data), this.crashReporter)
  }
}
