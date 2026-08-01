import type {
  ICategoriesRepository,
  ICategory,
} from '@panda-lavanda/domain'

import {
  HttpRepository,
  type HttpRepositoryConfig,
} from './http.repository'

/**
 * HTTP-реализация {@link ICategoriesRepository}.
 *
 * Всё хранение живёт в выделенном бэкенде (`apps/api`, Fastify + Drizzle). Этот
 * адаптер — тонкий клиент: обращается к бэкенду через `fetch` (через общий базовый
 * класс {@link HttpRepository}) и трактует JSON-ответ как доменную сущность
 * {@link ICategory} (бэкенд уже отдаёт camelCase-сущности, маппинг прямой).
 *
 * `getBySlug` трактует `404` как легитимное «не найдено» и возвращает `null`
 * (чтобы соблюсти контракт порта) — поэтому он вызывает {@link request} напрямую
 * и проверяет статус до разбора тела; `getMany` использует типизированный `get`.
 */
export class HttpCategoriesRepository
  extends HttpRepository
  implements ICategoriesRepository
{
  constructor(config: HttpRepositoryConfig) {
    super(config)
  }

  async getMany(): Promise<ICategory[]> {
    return this.get<ICategory[]>('/categories')
  }

  async getBySlug(slug: string): Promise<ICategory | null> {
    // 404 → null: см. HttpProductsRepository.getBySlug. `slug` URL-кодируется,
    // т.к. это пользовательский сегмент адреса (хотя сгенерированные slug'и уже URL-safe).
    const response = await this.request(
      `/categories/by-slug/${encodeURIComponent(slug)}`,
      { method: 'GET' },
    )
    if (response.status === 404) return null
    return (await response.json()) as ICategory
  }
}
