import {
  GetCategoriesUseCase,
  GetCategoryBySlugUseCase,
} from '@panda-lavanda/application'
import type { ICategoriesRepository } from '@panda-lavanda/domain'
import { HttpCategoriesRepository } from '@panda-lavanda/infrastructure'

import { env } from '#/shared/lib/env.server'

/**
 * Composition root for the categories feature.
 *
 * Единственное место, которое знает, какой конкретный бэкенд категорий
 * использует приложение. Всё остальное зависит от порта
 * {@link ICategoriesRepository} (или построенных на нём use cases), поэтому
 * замена реализации — это изменение, локализованное здесь.
 *
 * Хранение живёт в выделенном бэкенде (`apps/api`); этот адаптер обращается к
 * нему по HTTP через {@link HttpCategoriesRepository}. URL бэкенда
 * валидируется zod при загрузке модуля в `shared/lib/env.server.ts`
 * (`env.BACKEND_URL`).
 *
 * Экспортирует как подключённый репозиторий, так и готовые use cases —
 * соответствует соглашению из {@link ./products.ts} (потребители в server
 * functions не создают use cases сами).
 */
export const categoriesRepository: ICategoriesRepository =
  new HttpCategoriesRepository({ baseUrl: env.BACKEND_URL })

export const getCategoriesUseCase = new GetCategoriesUseCase(categoriesRepository)

export const getCategoryBySlugUseCase =
  new GetCategoryBySlugUseCase(categoriesRepository)
