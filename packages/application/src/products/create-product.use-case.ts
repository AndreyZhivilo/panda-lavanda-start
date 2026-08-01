import type { Either } from '@sweet-monads/either'

import type {
  CreateProductData,
  ICrashReporterService,
  IProduct,
  IProductsRepository,
} from '@panda-lavanda/domain'
import { tryCatch } from '@panda-lavanda/shared'

/**
 * Creates a new product with its exemplars.
 *
 * Application-layer use case wrapping {@link IProductsRepository.create}: it
 * delegates the write to the repository and converts any thrown error into an
 * `Either.Left`, so callers never have to `try/catch` across layer boundaries
 * (see AGENTS.md → Error handling). The slug is derived from the name inside
 * the repository/backend, so callers pass name/description/category/images/
 * exemplars only.
 */
export class CreateProductUseCase {
  constructor(
    private readonly products: IProductsRepository,
    private readonly crashReporter?: ICrashReporterService,
  ) {}

  execute(data: CreateProductData): Promise<Either<Error, IProduct>> {
    return tryCatch(() => this.products.create(data), this.crashReporter)
  }
}
