import type { ImageUrl, UniqueId } from '@panda-lavanda/shared'

/**
 * Категория — группа, объединяющая товары каталога (лаванда, кустарники,
 * многолетники …). Товар принадлежит ровно одной категории
 * (`IProduct.category: UniqueId`); категория может содержать много товаров.
 *
 * Чистый интерфейс данных без поведения: конкретное хранилище (Drizzle в
 * `apps/api`) реализует {@link ICategoriesRepository} и возвращает значения
 * этого вида.
 */
export interface ICategory {
  id: UniqueId
  /**
   * URL-friendly идентификатор, используемый как публичный сегмент адреса
   * (`/categories/$categorySlug`). Уникален по категории.
   */
  slug: string
  name: string
  /**
   * Необязательная картинка-обложка категории. `null`, когда обложки нет —
   * слой хранения хранит колонку как nullable, а домен сохраняет это различие.
   */
  image: ImageUrl | null
}
