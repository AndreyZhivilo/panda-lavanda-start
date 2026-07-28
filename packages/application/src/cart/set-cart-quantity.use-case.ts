import type { Either } from '@sweet-monads/either'

import type {
  ICart,
  ICartRepository,
  ICrashReporterService,
} from '@panda-lavanda/domain'
import type { UniqueId } from '@panda-lavanda/shared'
import { tryCatch } from '@panda-lavanda/shared'

/**
 * Sets the quantity of a line in the current cart.
 *
 * Application-layer use case wrapping {@link ICartRepository.setQuantity}: it
 * delegates the mutation to the repository and converts any thrown error into
 * an `Either.Left`, so callers never have to `try/catch` across layer
 * boundaries (see AGENTS.md → Error handling). A quantity of zero or below
 * removes the line. Returns the updated cart.
 */
export class SetCartQuantityUseCase {
  constructor(
    private readonly cart: ICartRepository,
    private readonly crashReporter?: ICrashReporterService,
  ) {}

  execute(
    exemplarId: UniqueId,
    quantity: number,
  ): Promise<Either<Error, ICart>> {
    return tryCatch(
      () => this.cart.setQuantity(exemplarId, quantity),
      this.crashReporter,
    )
  }
}
