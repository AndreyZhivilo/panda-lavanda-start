import { eq } from 'drizzle-orm'

import type {
  ICategoriesRepository,
  ICategory,
} from '@panda-lavanda/domain'

import type { Db } from '../db/client'
import { categories as categoriesTable } from '../schema/categories'
import type { CategoryRow } from '../schema/categories'

/**
 * Drizzle-backed implementation of {@link ICategoriesRepository}.
 *
 * Maps between the relational rows (snake_case) and the domain entity
 * (camelCase). Категории хранятся в одной таблице, поэтому JOIN'ы не нужны.
 *
 * Доменные типы импортируются как `import type` только (нет runtime-зависимости
 * от `@panda-lavanda/domain`) — значения это простые JSON-сериализуемые объекты,
 * поэтому репозиторий возвращает их напрямую, а Fastify сериализует ответ.
 */
export class CategoriesRepository implements ICategoriesRepository {
  constructor(private readonly db: Db) {}

  async getMany(): Promise<ICategory[]> {
    const rows = await this.db.select().from(categoriesTable)
    return rows.map(toCategory)
  }

  async getBySlug(slug: string): Promise<ICategory | null> {
    const [row] = await this.db
      .select()
      .from(categoriesTable)
      .where(eq(categoriesTable.slug, slug))
      .limit(1)

    return row ? toCategory(row) : null
  }
}

/**
 * Maps a raw category row to the domain {@link ICategory} shape.
 * `image` is nullable in the column, so `null` flows through directly.
 */
function toCategory(row: CategoryRow): ICategory {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    image: row.image ?? null,
  }
}
