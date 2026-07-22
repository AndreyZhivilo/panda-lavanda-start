import type { Either } from '@sweet-monads/either'

import type {
  ICrashReporterService,
  IUser,
  IUserRepository,
} from '@panda-lavanda/domain'
import type { UniqueId } from '@panda-lavanda/shared'
import { tryCatch } from '@panda-lavanda/shared'

/**
 * Toggles a product in the current user's favorites.
 *
 * Application-layer use case wrapping
 * {@link IUserRepository.toggleFavoriteProduct}: it delegates the mutation to
 * the repository and converts any thrown error into an `Either.Left`, so
 * callers never have to `try/catch` across layer boundaries (see AGENTS.md →
 * Error handling). Returns the updated user.
 */
export class ToggleFavoriteProductUseCase {
  constructor(
    private readonly users: IUserRepository,
    private readonly crashReporter?: ICrashReporterService,
  ) {}

  execute(productId: UniqueId): Promise<Either<Error, IUser>> {
    return tryCatch(
      () => this.users.toggleFavoriteProduct(productId),
      this.crashReporter,
    )
  }
}
