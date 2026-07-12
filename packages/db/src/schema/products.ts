import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * Size enum — mirrors the domain `Size` values.
 * Keep the string values in sync with `@panda-lavanda/domain` (products/product.ts).
 */
export const sizeEnum = pgEnum('size', ['p9', 'p11'])

/**
 * Product — the sellable item (e.g. a plush panda in a given line).
 * Images are stored as a JSONB array of URLs.
 * Exemplars (size/price/stock variants) live in a separate table.
 */
export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description').notNull(),
  categoryId: uuid('category_id').notNull(),
  images: jsonb('images').$type<string[]>().notNull(),
})

/**
 * Exemplar — a concrete variant of a product (size + price + availability).
 * Deleting a product cascades to its exemplars (referential integrity).
 */
export const exemplars = pgTable('exemplars', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  price: integer('price').notNull(),
  inStock: boolean('in_stock').notNull(),
  size: sizeEnum('size').notNull(),
})

/** Raw row shape as selected from the products table. */
export type ProductRow = typeof products.$inferSelect
/** Raw row shape as selected from the exemplars table. */
export type ExemplarRow = typeof exemplars.$inferSelect
