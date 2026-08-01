import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

import { sizeEnum } from './products'

/**
 * Order lifecycle status.
 *
 * The string values mirror the domain `OrderStatus` const-object
 * (`packages/domain/src/orders/order.ts`) exactly — they must stay in sync.
 * New orders default to `'new'` (see {@link orders.status}).
 */
export const orderStatusEnum = pgEnum('order_status', [
  'new',
  'processing',
  'completed',
  'cancelled',
])

/**
 * Shopper's preferred contact method.
 *
 * The string values mirror the domain `ContactMethod` const-object
 * (`packages/domain/src/orders/order.ts`) exactly — they must stay in sync.
 */
export const contactMethodEnum = pgEnum('contact_method', [
  'call',
  'telegram',
  'whatsapp',
  'max',
  'vkontakte',
])

/**
 * A customer's order.
 *
 * Anonymous for now (no authentication — see the domain `IOrder`): the shopper
 * is identified only by the contact details they entered at checkout. `status`
 * defaults to `'new'`; the other statuses model a future admin/processing flow.
 */
export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerName: varchar('customer_name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 64 }).notNull(),
  contactMethod: contactMethodEnum('contact_method').notNull(),
  comment: text('comment'),
  totalPrice: integer('total_price').notNull(),
  status: orderStatusEnum('status').default('new').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
})

/**
 * A single line of an order — a **denormalized snapshot** taken at checkout.
 *
 * `product_name`, `size` and `unit_price` are copied from the catalog when the
 * order is placed, so editing or deleting a product later never alters a past
 * order. `exemplar_id` / `product_id` are kept as soft references (no foreign
 * key to `exemplars` / `products`) on purpose: a deleted catalog row must never
 * break an existing order's integrity. The `size` column reuses the catalog
 * `sizeEnum` so the snapshot value stays within the known size set.
 */
export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  exemplarId: uuid('exemplar_id').notNull(),
  productId: uuid('product_id').notNull(),
  productName: varchar('product_name', { length: 255 }).notNull(),
  size: sizeEnum('size').notNull(),
  unitPrice: integer('unit_price').notNull(),
  quantity: integer('quantity').notNull(),
})

export type OrderRow = typeof orders.$inferSelect
export type OrderItemRow = typeof orderItems.$inferSelect
