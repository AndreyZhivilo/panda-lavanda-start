import type { Either } from '@sweet-monads/either'

import type {
  ICategoriesRepository,
  ICategory,
  ICrashReporterService,
} from '@panda-lavanda/domain'
import { tryCatch } from '@panda-lavanda/shared'

/**
 * Возвращает список всех категорий.
 *
 * Application-layer use case: делегирует чтение в {@link ICategoriesRepository.getMany}
 * и оборачивает любую ошибку в `Either.Left`, чтобы вызывающему коду не приходилось
 * `try/catch` через границы слоёв (см. AGENTS.md → Error handling).
 */
export class GetCategoriesUseCase {
  constructor(
    private readonly categories: ICategoriesRepository,
    private readonly crashReporter?: ICrashReporterService,
  ) {}

  execute(): Promise<Either<Error, ICategory[]>> {
    return tryCatch(() => this.categories.getMany(), this.crashReporter)
  }
}
