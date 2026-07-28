import type { Either } from '@sweet-monads/either'

import type {
  ICrashReporterService,
  IProduct,
  IProductsRepository,
} from '@panda-lavanda/domain'
import { tryCatch } from '@panda-lavanda/shared'

/**
 * Returns a single product by slug, or `null` when it does not exist.
 *
 * Application-layer use case wrapping the repository call: it delegates the
 * read to {@link IProductsRepository.getBySlug} (which maps a 404 to `null`)
 * and converts any thrown error into an `Either.Left`, so callers never have
 * to `try/catch` across layer boundaries (see AGENTS.md → Error handling).
 */
export class GetProductBySlugUseCase {
  constructor(
    private readonly products: IProductsRepository,
    private readonly crashReporter?: ICrashReporterService,
  ) {}

  execute(slug: string): Promise<Either<Error, IProduct | null>> {
    return tryCatch(() => this.products.getBySlug(slug), this.crashReporter)
  }
}
