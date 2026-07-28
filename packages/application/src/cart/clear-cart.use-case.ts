import type { Either } from '@sweet-monads/either'

import type {
  ICart,
  ICartRepository,
  ICrashReporterService,
} from '@panda-lavanda/domain'
import { tryCatch } from '@panda-lavanda/shared'

/**
 * Clears the current cart.
 *
 * Application-layer use case wrapping {@link ICartRepository.clear}: it
 * delegates the mutation to the repository and converts any thrown error into
 * an `Either.Left`, so callers never have to `try/catch` across layer
 * boundaries (see AGENTS.md → Error handling). Returns an empty cart. Intended
 * for the future checkout flow (clearing the cart once an order is placed).
 */
export class ClearCartUseCase {
  constructor(
    private readonly cart: ICartRepository,
    private readonly crashReporter?: ICrashReporterService,
  ) {}

  execute(): Promise<Either<Error, ICart>> {
    return tryCatch(() => this.cart.clear(), this.crashReporter)
  }
}
