import { and, count, desc, eq, inArray, sql, type SQL } from 'drizzle-orm'

import type {
  CreateProductData,
  IProduct,
  IProductFilters,
  IProductsRepository,
  SortOrder,
  UpdateProductData,
} from '@panda-lavanda/domain'
import type { Paginated, UniqueId } from '@panda-lavanda/shared'
import {
  exemplars as exemplarsTable,
  products as productsTable,
} from '@panda-lavanda/db'
import type { Db, ExemplarRow, ProductRow } from '@panda-lavanda/db'

/** Default page size when `filters.pageSize` is omitted. */
const DEFAULT_PAGE_SIZE = 20

/** Upper bound for a single page; protects against huge page sizes from the client. */
const MAX_PAGE_SIZE = 100

/**
 * Row shape used by the products-only `select(...)` in {@link getMany} /
 * {@link getById}. `category` is the camelCase rename of `products.category_id`,
 * so it's its own type rather than the raw `ProductRow`.
 */
type ProductSelectRow = {
  id: ProductRow['id']
  name: ProductRow['name']
  description: ProductRow['description']
  category: ProductRow['categoryId']
  images: ProductRow['images']
  createdAt: ProductRow['createdAt']
}

/**
 * Correlated subquery: `true` if the product has at least one exemplar in
 * stock. Used in ORDER BY to push out-of-stock products to the end.
 */
const IN_STOCK_EXPR = sql<boolean>`exists (
  select 1 from ${exemplarsTable}
  where ${exemplarsTable.productId} = ${productsTable.id}
    and ${exemplarsTable.inStock} = true
)`

/**
 * Drizzle-backed implementation of {@link IProductsRepository}.
 *
 * Maps between the relational rows (snake_case) and the domain entities
 * (camelCase). Products and their exemplars are loaded in two separate
 * queries (one `IN`-query per page) rather than a LEFT JOIN, to avoid row
 * duplication and to keep pagination/sort deterministic.
 */
export class DrizzleProductsRepository implements IProductsRepository {
  constructor(private readonly db: Db) {}

  async create(data: CreateProductData): Promise<IProduct> {
    const id = await this.db.transaction(async (tx) => {
      const [product] = await tx
        .insert(productsTable)
        .values({
          name: data.name,
          description: data.description,
          categoryId: data.category,
          images: data.images,
        })
        .returning({ id: productsTable.id })

      if (data.exemplars.length > 0) {
        await tx.insert(exemplarsTable).values(
          data.exemplars.map((exemplar) => ({
            productId: product.id,
            price: exemplar.price,
            inStock: exemplar.inStock,
            size: exemplar.size,
          })),
        )
      }

      return product.id
    })

    // The row was just inserted, so it is guaranteed to exist.
    return (await this.getById(id))!
  }

  async getMany(filters: IProductFilters): Promise<Paginated<IProduct>> {
    const page = filters.page && filters.page > 0 ? filters.page : 1
    const requestedSize =
      filters.pageSize && filters.pageSize > 0 ? filters.pageSize : DEFAULT_PAGE_SIZE
    const pageSize = Math.min(requestedSize, MAX_PAGE_SIZE)
    const offset = (page - 1) * pageSize

    const conditions = this.buildConditions(filters)

    // (1) Page of products — no JOIN, deterministic ORDER BY.
    // We `Promise.all` it with (2) and (3) so the three round-trips overlap.
    const productRowsPromise = this.db
      .select({
        id: productsTable.id,
        name: productsTable.name,
        description: productsTable.description,
        category: productsTable.categoryId,
        images: productsTable.images,
        createdAt: productsTable.createdAt,
      })
      .from(productsTable)
      .where(and(...conditions))
      .orderBy(...this.buildOrderBy(filters.sort))
      .limit(pageSize)
      .offset(offset)

    const totalPromise = this.db
      .select({ count: count() })
      .from(productsTable)
      .where(and(...conditions))

    const [productRows, [totalRow]] = await Promise.all([
      productRowsPromise,
      totalPromise,
    ])
    const total = Number(totalRow?.count ?? 0)

    if (productRows.length === 0) {
      return { items: [], total }
    }

    // (2) Exemplars for the page's product ids — one IN-query, not N queries.
    const productIds = productRows.map((p) => p.id)
    const exemplarRows = await this.db
      .select()
      .from(exemplarsTable)
      .where(inArray(exemplarsTable.productId, productIds))

    return {
      items: this.mergeProducts(productRows, exemplarRows),
      total,
    }
  }

  /**
   * Shared WHERE conditions for product filters. Used by both the items query
   * and the count query so they always agree on the filtered set.
   */
  private buildConditions(filters: IProductFilters) {
    return [
      filters.categoryId
        ? eq(productsTable.categoryId, filters.categoryId)
        : undefined,
      filters.ids?.length
        ? inArray(productsTable.id, filters.ids)
        : undefined,
    ]
  }

  /**
   * ORDER BY expressions for a product list.
   *
   * - If `sort` contains `OUT_OF_STOCK_LAST`, the primary key is the
   *   `IN_STOCK_EXPR` DESC (in-stock products first).
   * - The final tie-breaker is always `created_at DESC` (newest first), so
   *   products with equal stock-status have a stable, meaningful order.
   * - Without any sort key, the default is still `created_at DESC`.
   */
  private buildOrderBy(sort?: SortOrder[]) {
    const orderBy: SQL[] = []
    if (sort?.includes('out-of-stock-last')) {
      orderBy.push(desc(IN_STOCK_EXPR))
    }
    orderBy.push(desc(productsTable.createdAt))
    return orderBy
  }

  async getById(id: UniqueId): Promise<IProduct | null> {
    const [productRow] = await this.db
      .select({
        id: productsTable.id,
        name: productsTable.name,
        description: productsTable.description,
        category: productsTable.categoryId,
        images: productsTable.images,
        createdAt: productsTable.createdAt,
      })
      .from(productsTable)
      .where(eq(productsTable.id, id))
      .limit(1)

    if (!productRow) return null

    const exemplarRows = await this.db
      .select()
      .from(exemplarsTable)
      .where(eq(exemplarsTable.productId, id))

    return this.mergeProducts([productRow], exemplarRows)[0]
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
   * Builds {@link IProduct}s from already-fetched product rows and exemplar
   * rows. Exemplars are grouped by `productId` in a Map for O(n) lookup, then
   * attached to each product **in the order `productRows` arrives in** — this
   * is what preserves the ORDER BY from the items query (the previous
   * LEFT-JOIN+groupProducts approach lost that order).
   */
  private mergeProducts(
    productRows: ProductSelectRow[],
    exemplarRows: ExemplarRow[],
  ): IProduct[] {
    const exemplarsByProductId = new Map<string, ExemplarRow[]>()
    for (const row of exemplarRows) {
      const list = exemplarsByProductId.get(row.productId)
      if (list) list.push(row)
      else exemplarsByProductId.set(row.productId, [row])
    }

    return productRows.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      category: p.category,
      images: p.images,
      exemplars: (exemplarsByProductId.get(p.id) ?? []).map((e) => ({
        id: e.id,
        price: e.price,
        inStock: e.inStock,
        size: e.size,
      })),
    }))
  }
}
