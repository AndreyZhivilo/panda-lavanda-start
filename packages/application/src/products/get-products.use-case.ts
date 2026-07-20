import type { Either } from '@sweet-monads/either'

import type {
  ICrashReporterService,
  IProduct,
  IProductFilters,
  IProductsRepository,
} from '@panda-lavanda/domain'
import type { Paginated } from '@panda-lavanda/shared'
import { tryCatch } from '@panda-lavanda/shared'

/**
 * Returns the list of products matching the given filters.
 *
 * This is the application-layer use case wrapping the repository call: it
 * delegates the read to {@link IProductsRepository.getMany} and converts any
 * thrown error into an `Either.Left`, so callers never have to `try/catch`
 * across layer boundaries (see AGENTS.md → Error handling).
 */
export class GetProductsUseCase {
  constructor(
    private readonly products: IProductsRepository,
    private readonly crashReporter?: ICrashReporterService,
  ) {}

  execute(filters: IProductFilters): Promise<Either<Error, Paginated<IProduct>>> {
    return tryCatch(() => this.products.getMany(filters), this.crashReporter)
  }
}
