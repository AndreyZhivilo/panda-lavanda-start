import type { ICategory } from '../categories'

/**
 * Контракт репозитория категорий.
 *
 * Интерфейс живёт в доменном слое; конкретные реализации (Drizzle в `apps/api`,
 * HTTP-адаптер в `infrastructure`) живут в других слоях и внедряются в
 * composition root. Так домен остаётся независимым от базы данных и от способа
 * доступа к данным (см. AGENTS.md → Ports).
 *
 * Категорий немного, поэтому список не пагинируется (в отличие от товаров) —
 * `getMany()` возвращает всё разом.
 */
export interface ICategoriesRepository {
  /** Возвращает все категории. */
  getMany(): Promise<ICategory[]>
  /** Возвращает категорию по slug или `null`, если такой нет. */
  getBySlug(slug: string): Promise<ICategory | null>
}
