import { and, eq, inArray } from 'drizzle-orm'

import type {
  IProduct,
  IProductFilters,
  IProductsRepository,
  UpdateProductData,
} from '@panda-lavanda/domain'
import type { UniqueId } from '@panda-lavanda/shared'
import {
  exemplars as exemplarsTable,
  products as productsTable,
} from '@panda-lavanda/db'
import type { Db, ExemplarRow, ProductRow } from '@panda-lavanda/db'

/** Products per page when `filters.page` is provided. */
const PAGE_SIZE = 20

/** Shape returned by `select().from(products).leftJoin(exemplars)`. */
type JoinedRow = {
  products: ProductRow
  exemplars: ExemplarRow | null
}

/**
 * Drizzle-backed implementation of {@link IProductsRepository}.
 *
 * Maps between the relational rows (snake_case) and the domain entities
 * (camelCase). Exemplars are loaded via a LEFT JOIN and grouped in JS so a
 * product always carries its full variant list.
 */
export class DrizzleProductsRepository implements IProductsRepository {
  constructor(private readonly db: Db) {}

  async getMany(filters: IProductFilters): Promise<IProduct[]> {
    const page = filters.page && filters.page > 0 ? filters.page : 1
    const offset = (page - 1) * PAGE_SIZE

    const conditions = [
      filters.categoryId
        ? eq(productsTable.categoryId, filters.categoryId)
        : undefined,
      filters.ids?.length
        ? inArray(productsTable.id, filters.ids)
        : undefined,
    ]

    const rows: JoinedRow[] = await this.db
      .select()
      .from(productsTable)
      .leftJoin(exemplarsTable, eq(exemplarsTable.productId, productsTable.id))
      .where(and(...conditions))
      .limit(PAGE_SIZE)
      .offset(offset)

    return this.groupProducts(rows)
  }

  async getById(id: UniqueId): Promise<IProduct | null> {
    const rows: JoinedRow[] = await this.db
      .select()
      .from(productsTable)
      .leftJoin(exemplarsTable, eq(exemplarsTable.productId, productsTable.id))
      .where(eq(productsTable.id, id))

    const products = this.groupProducts(rows)
    return products[0] ?? null
  }

  async delete(id: UniqueId): Promise<void> {
    // Cascade FK removes the exemplars automatically.
    await this.db.delete(productsTable).where(eq(productsTable.id, id))
  }

  async update(id: UniqueId, data: UpdateProductData): Promise<IProduct | null> {
    const patch = {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.category !== undefined && { categoryId: data.category }),
      ...(data.images !== undefined && { images: data.images }),
    }

    // Nothing to update — return the current state.
    if (Object.keys(patch).length === 0) return this.getById(id)

    await this.db
      .update(productsTable)
      .set(patch)
      .where(eq(productsTable.id, id))

    return this.getById(id)
  }

  /**
   * Groups joined rows back into products, each carrying its exemplars.
   * A product with no exemplars still appears (LEFT JOIN yields a null row).
   */
  private groupProducts(rows: ProductWithExemplars[]): IProduct[] {
    const byId = new Map<string, IProduct>()

    for (const row of rows) {
      let product = byId.get(row.id)
      if (!product) {
        product = {
          id: row.id,
          name: row.name,
          description: row.description,
          category: row.categoryId,
          images: row.images,
          exemplars: [],
        }
        byId.set(row.id, product)
      }

      if (row.exemplars) {
        product.exemplars.push({
          id: row.exemplars.id,
          price: row.exemplars.price,
          inStock: row.exemplars.inStock,
          size: row.exemplars.size,
        })
      }
    }

    return [...byId.values()]
  }
}
