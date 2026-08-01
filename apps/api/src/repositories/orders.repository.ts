import { eq } from 'drizzle-orm'

import type {
  CreateOrderData,
  IOrder,
  IOrderItem,
  IOrdersRepository,
} from '@panda-lavanda/domain'
import type { UniqueId } from '@panda-lavanda/shared'

import type { Db } from '../db/client'
import {
  orderItems as orderItemsTable,
  orders as ordersTable,
} from '../schema/orders'
import type { OrderItemRow, OrderRow } from '../schema/orders'

/**
 * Drizzle-backed implementation of {@link IOrdersRepository}.
 *
 * Maps between the relational rows (snake_case) and the domain entities
 * (camelCase). An order and its lines are loaded in two separate queries (the
 * order row, then its lines via an `eq` on `order_id`) rather than a JOIN, to
 * avoid row duplication — the same approach {@link ProductsRepository} takes
 * for products → exemplars.
 *
 * Domain types are imported as `import type` only (no runtime dependency on
 * `@panda-lavanda/domain`) — the values are plain JSON-serializable objects,
 * so the repository returns them directly and Fastify serializes the response.
 */
export class OrdersRepository implements IOrdersRepository {
  constructor(private readonly db: Db) {}

  async create(data: CreateOrderData): Promise<IOrder> {
    const id = await this.db.transaction(async (tx) => {
      const [order] = await tx
        .insert(ordersTable)
        .values({
          customerName: data.customerName,
          phone: data.phone,
          contactMethod: data.contactMethod,
          comment: data.comment,
          totalPrice: data.totalPrice,
        })
        .returning({ id: ordersTable.id })

      // The form guarantees at least one line, but guard anyway so an empty
      // cart can never produce a header-only order silently.
      if (data.items.length > 0) {
        await tx.insert(orderItemsTable).values(
          data.items.map((item) => ({
            orderId: order.id,
            exemplarId: item.exemplarId,
            productId: item.productId,
            productName: item.productName,
            size: item.size,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
          })),
        )
      }

      return order.id
    })

    // The row was just inserted, so it is guaranteed to exist.
    return (await this.getById(id))!
  }

  async getById(id: UniqueId): Promise<IOrder | null> {
    const [orderRow] = await this.db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, id))
      .limit(1)

    if (!orderRow) return null

    const itemRows = await this.db
      .select()
      .from(orderItemsTable)
      .where(eq(orderItemsTable.orderId, id))

    return mergeOrder(orderRow, itemRows)
  }
}

/**
 * Builds an {@link IOrder} from an already-fetched order row and its line rows.
 * The line rows are attached in the order they arrive in (insertion order).
 */
function mergeOrder(orderRow: OrderRow, itemRows: OrderItemRow[]): IOrder {
  return {
    id: orderRow.id,
    customerName: orderRow.customerName,
    phone: orderRow.phone,
    contactMethod: orderRow.contactMethod,
    comment: orderRow.comment ?? undefined,
    totalPrice: orderRow.totalPrice,
    status: orderRow.status,
    createdAt: orderRow.createdAt.toISOString(),
    items: itemRows.map(toOrderItem),
  }
}

/**
 * Maps a raw order-item row to the domain {@link IOrderItem} shape.
 * Item columns are all non-null, so the mapping is direct.
 */
function toOrderItem(row: OrderItemRow): IOrderItem {
  return {
    id: row.id,
    exemplarId: row.exemplarId,
    productId: row.productId,
    productName: row.productName,
    size: row.size,
    unitPrice: row.unitPrice,
    quantity: row.quantity,
  }
}
