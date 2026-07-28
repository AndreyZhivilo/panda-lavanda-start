import type { Either } from '@sweet-monads/either'

import type {
  ICart,
  ICartRepository,
  ICrashReporterService,
} from '@panda-lavanda/domain'
import { tryCatch } from '@panda-lavanda/shared'

/**
 * Returns the current cart.
 *
 * Application-layer use case wrapping {@link ICartRepository.get}: it delegates
 * the read to the repository and converts any thrown error into an
 * `Either.Left`, so callers never have to `try/catch` across layer boundaries
 * (see AGENTS.md → Error handling).
 *
 * Corrupt-storage recovery happens *inside* the repository, not here: the
 * LocalStorage adapter knows how to detect and seed around bad data (logging
 * via its own crash reporter), so it returns a usable {@link ICart} instead of
 * throwing. Only adapter-unavailable errors (e.g. server-side misuse) propagate
 * here and become `Either.Left`.
 */
export class GetCartUseCase {
  constructor(
    private readonly cart: ICartRepository,
    private readonly crashReporter?: ICrashReporterService,
  ) {}

  execute(): Promise<Either<Error, ICart>> {
    return tryCatch(() => this.cart.get(), this.crashReporter)
  }
}
