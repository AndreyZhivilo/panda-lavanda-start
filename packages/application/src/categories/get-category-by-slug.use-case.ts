import type { Either } from '@sweet-monads/either'

import type {
  ICategoriesRepository,
  ICategory,
  ICrashReporterService,
} from '@panda-lavanda/domain'
import { tryCatch } from '@panda-lavanda/shared'

/**
 * Возвращает одну категорию по slug или `null`, если такой нет.
 *
 * Application-layer use case: делегирует чтение в {@link ICategoriesRepository.getBySlug}
 * (которая отображает 404 в `null`) и оборачивает любую ошибку в `Either.Left`,
 * чтобы вызывающему коду не приходилось `try/catch` через границы слоёв
 * (см. AGENTS.md → Error handling).
 */
export class GetCategoryBySlugUseCase {
  constructor(
    private readonly categories: ICategoriesRepository,
    private readonly crashReporter?: ICrashReporterService,
  ) {}

  execute(slug: string): Promise<Either<Error, ICategory | null>> {
    return tryCatch(() => this.categories.getBySlug(slug), this.crashReporter)
  }
}
