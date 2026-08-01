import { pgTable, uuid, varchar } from 'drizzle-orm/pg-core'

/**
 * Категория — группа, объединяющая товары каталога.
 *
 * Товар (`products`) принадлежит ровно одной категории через внешний ключ
 * `products.category_id → categories.id`. Удаление категории, на которую
 * ссылаются товары, запрещено (`onDelete: 'no action'` — чтобы не потерять
 * товары случайно; см. `products.categoryId`).
 *
 * `image` — необязательная обложка категории (URL); `null`, когда её нет.
 */
export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  /**
   * URL-friendly идентификатор, используемый как публичный сегмент адреса
   * (`/categories/$categorySlug`). Уникален по категории.
   */
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  image: varchar('image', { length: 512 }),
})

/** Raw row shape as selected from the categories table. */
export type CategoryRow = typeof categories.$inferSelect
