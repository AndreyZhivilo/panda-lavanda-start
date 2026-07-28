import type { Either } from '@sweet-monads/either'

import type {
  ICart,
  ICartItem,
  ICartRepository,
  ICrashReporterService,
} from '@panda-lavanda/domain'
import { tryCatch } from '@panda-lavanda/shared'

/**
 * Adds an item to the current cart.
 *
 * Application-layer use case wrapping {@link ICartRepository.addItem}: it
 * delegates the mutation (including merging quantity into an existing line for
 * the same exemplar) to the repository and converts any thrown error into an
 * `Either.Left`, so callers never have to `try/catch` across layer boundaries
 * (see AGENTS.md → Error handling). Returns the updated cart.
 */
export class AddCartItemUseCase {
  constructor(
    private readonly cart: ICartRepository,
    private readonly crashReporter?: ICrashReporterService,
  ) {}

  execute(item: ICartItem): Promise<Either<Error, ICart>> {
    return tryCatch(() => this.cart.addItem(item), this.crashReporter)
  }
}
