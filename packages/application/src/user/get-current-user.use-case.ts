import type { Either } from '@sweet-monads/either'

import type {
  ICrashReporterService,
  IUser,
  IUserRepository,
} from '@panda-lavanda/domain'
import { tryCatch } from '@panda-lavanda/shared'

/**
 * Returns the current user.
 *
 * Application-layer use case wrapping {@link IUserRepository.getCurrent}: it
 * delegates the read to the repository and converts any thrown error into an
 * `Either.Left`, so callers never have to `try/catch` across layer boundaries
 * (see AGENTS.md → Error handling).
 *
 * Corrupt-storage recovery happens *inside* the repository, not here: the
 * LocalStorage adapter knows how to detect and seed around bad data (logging
 * via its own crash reporter), so it returns a usable {@link IUser} instead
 * of throwing. Only adapter-unavailable errors (e.g. server-side misuse)
 * propagate here and become `Either.Left`.
 */
export class GetCurrentUserUseCase {
  constructor(
    private readonly users: IUserRepository,
    private readonly crashReporter?: ICrashReporterService,
  ) {}

  execute(): Promise<Either<Error, IUser>> {
    return tryCatch(() => this.users.getCurrent(), this.crashReporter)
  }
}
