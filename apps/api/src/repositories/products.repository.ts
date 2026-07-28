import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  like,
  or,
  sql,
  type SQL,
} from 'drizzle-orm'

import type {
  CreateExemplarData,
  CreateProductData,
  IExemplar,
  IProduct,
  IProductFilters,
  IProductsRepository,
  SortOrder,
  UpdateExemplarData,
  UpdateProductData,
} from '@panda-lavanda/domain'
import type { Paginated, UniqueId } from '@panda-lavanda/shared'

import type { Db } from '../db/client'
import {
  exemplars as exemplarsTable,
  products as productsTable,
} from '../schema/products'
import type { ExemplarRow, ProductRow } from '../schema/products'
import { toSlug } from '../utils/slug'

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
  slug: ProductRow['slug']
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
 *
 * Domain types are imported as `import type` only (no runtime dependency on
 * `@panda-lavanda/domain`) — the values are plain JSON-serializable objects,
 * so the repository returns them directly and Fastify serializes the response.
 */
export class ProductsRepository implements IProductsRepository {
  constructor(private readonly db: Db) {}

  async create(data: CreateProductData): Promise<IProduct> {
    const id = await this.db.transaction(async (tx) => {
      const [product] = await tx
        .insert(productsTable)
        .values({
          name: data.name,
          slug: await this.findUniqueSlug(tx, toSlug(data.name)),
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
        slug: productsTable.slug,
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
      filters.search?.trim()
        ? ilike(productsTable.name, `%${filters.search.trim()}%`)
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
        slug: productsTable.slug,
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

  async getBySlug(slug: string): Promise<IProduct | null> {
    const [productRow] = await this.db
      .select({
        id: productsTable.id,
        slug: productsTable.slug,
        name: productsTable.name,
        description: productsTable.description,
        category: productsTable.categoryId,
        images: productsTable.images,
        createdAt: productsTable.createdAt,
      })
      .from(productsTable)
      .where(eq(productsTable.slug, slug))
      .limit(1)

    if (!productRow) return null

    const exemplarRows = await this.db
      .select()
      .from(exemplarsTable)
      .where(eq(exemplarsTable.productId, productRow.id))

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
    const hasProductPatch = Object.keys(patch).length > 0
    const hasExemplars = data.exemplars !== undefined

    // Nothing to update — return the current state.
    if (!hasProductPatch && !hasExemplars) return this.getById(id)

    // Wrap in a transaction so the product UPDATE and the exemplar replacement
    // (delete + insert) commit together. We also guard existence up front:
    // otherwise the exemplar INSERT would fail on the FK and surface as a 500
    // instead of the contract's `null`.
    const updated = await this.db.transaction(async (tx) => {
      if (hasProductPatch) {
        const [row] = await tx
          .update(productsTable)
          .set(patch)
          .where(eq(productsTable.id, id))
          .returning({ id: productsTable.id })
        // Return null if the product did not exist; skip the exemplar work.
        if (!row) return null
      } else if (hasExemplars) {
        const [row] = await tx
          .select({ id: productsTable.id })
          .from(productsTable)
          .where(eq(productsTable.id, id))
          .limit(1)
        if (!row) return null
      }

      // Full replacement: delete all existing exemplars, then insert the new
      // set (empty array is allowed — clears the product's variants).
      if (hasExemplars) {
        await tx.delete(exemplarsTable).where(eq(exemplarsTable.productId, id))
        if (data.exemplars!.length > 0) {
          await tx.insert(exemplarsTable).values(
            data.exemplars!.map((exemplar) => ({
              productId: id,
              price: exemplar.price,
              inStock: exemplar.inStock,
              size: exemplar.size,
            })),
          )
        }
      }

      return id
    })

    if (!updated) return null
    return this.getById(id)
  }

  async getExemplar(
    productId: UniqueId,
    exemplarId: UniqueId,
  ): Promise<IExemplar | null> {
    const [row] = await this.db
      .select()
      .from(exemplarsTable)
      .where(
        and(
          eq(exemplarsTable.id, exemplarId),
          eq(exemplarsTable.productId, productId),
        ),
      )
      .limit(1)
    return row ? toExemplar(row) : null
  }

  async createExemplar(
    productId: UniqueId,
    data: CreateExemplarData,
  ): Promise<IExemplar | null> {
    // Guard existence: INSERT against a missing product would fail on the FK
    // and surface as a 500; the contract is `null`.
    const [product] = await this.db
      .select({ id: productsTable.id })
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .limit(1)
    if (!product) return null

    const [row] = await this.db
      .insert(exemplarsTable)
      .values({
        productId,
        price: data.price,
        inStock: data.inStock,
        size: data.size,
      })
      .returning()
    return toExemplar(row)
  }

  async updateExemplar(
    productId: UniqueId,
    exemplarId: UniqueId,
    data: UpdateExemplarData,
  ): Promise<IExemplar | null> {
    const patch = {
      ...(data.price !== undefined && { price: data.price }),
      ...(data.inStock !== undefined && { inStock: data.inStock }),
      ...(data.size !== undefined && { size: data.size }),
    }

    // Nothing to update — return the current state (if it exists).
    if (Object.keys(patch).length === 0) {
      return this.getExemplar(productId, exemplarId)
    }

    const [row] = await this.db
      .update(exemplarsTable)
      .set(patch)
      .where(
        and(
          eq(exemplarsTable.id, exemplarId),
          eq(exemplarsTable.productId, productId),
        ),
      )
      .returning()
    return row ? toExemplar(row) : null
  }

  async deleteExemplar(
    productId: UniqueId,
    exemplarId: UniqueId,
  ): Promise<void> {
    // Idempotent: deleting a row that is already gone deletes nothing.
    await this.db
      .delete(exemplarsTable)
      .where(
        and(
          eq(exemplarsTable.id, exemplarId),
          eq(exemplarsTable.productId, productId),
        ),
      )
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
      slug: p.slug,
      name: p.name,
      description: p.description,
      category: p.category,
      images: p.images,
      exemplars: (exemplarsByProductId.get(p.id) ?? []).map(toExemplar),
    }))
  }

  /**
   * Returns a slug guaranteed to be free in the `products` table at call time,
   * appending `-2`, `-3`, … when the base slug is already taken. `base` is the
   * transliterated name (see {@link toSlug}); if it is empty, a fallback is
   * used so the `NOT NULL` column is never written an empty string.
   *
   * This is a pre-check that races against concurrent inserts; the
   * `UNIQUE` DB constraint is the final guard and will reject any collision
   * that slips through (surfacing as a constraint-violation error). Run inside
   * the `create` transaction so the window is as small as possible.
   */
  private async findUniqueSlug(
    tx: Parameters<Parameters<Db['transaction']>[0]>[0],
    base: string,
  ): Promise<string> {
    const candidate = base || 'product'
    // Collect existing slugs that would collide: the exact base or any
    // `base-<n>` suffix. A single query covers both forms.
    const rows = await tx
      .select({ slug: productsTable.slug })
      .from(productsTable)
      .where(
        or(
          eq(productsTable.slug, candidate),
          like(productsTable.slug, `${candidate}-%`),
        ),
      )
    const taken = new Set(rows.map((r) => r.slug))
    if (!taken.has(candidate)) return candidate
    // The seed cycle appends ` #N` to names, which transliterates into the
    // slug as `-n`, so start probing from 2 to stay aligned with that scheme.
    for (let n = 2; ; n++) {
      const next = `${candidate}-${n}`
      if (!taken.has(next)) return next
    }
  }
}

/**
 * Maps a raw exemplar row to the domain {@link IExemplar} shape.
 * Used by `mergeProducts` and the single-exemplar repository methods so the
 * camelCase mapping lives in one place.
 */
function toExemplar(row: ExemplarRow): IExemplar {
  return {
    id: row.id,
    price: row.price,
    inStock: row.inStock,
    size: row.size,
  }
}
