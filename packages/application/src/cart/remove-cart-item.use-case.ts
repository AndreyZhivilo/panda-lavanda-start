import type { Either } from '@sweet-monads/either'

import type {
  ICart,
  ICartRepository,
  ICrashReporterService,
} from '@panda-lavanda/domain'
import type { UniqueId } from '@panda-lavanda/shared'
import { tryCatch } from '@panda-lavanda/shared'

/**
 * Removes a line from the current cart.
 *
 * Application-layer use case wrapping {@link ICartRepository.removeItem}: it
 * delegates the (idempotent) removal to the repository and converts any thrown
 * error into an `Either.Left`, so callers never have to `try/catch` across
 * layer boundaries (see AGENTS.md → Error handling). Returns the updated cart.
 */
export class RemoveCartItemUseCase {
  constructor(
    private readonly cart: ICartRepository,
    private readonly crashReporter?: ICrashReporterService,
  ) {}

  execute(exemplarId: UniqueId): Promise<Either<Error, ICart>> {
    return tryCatch(() => this.cart.removeItem(exemplarId), this.crashReporter)
  }
}
