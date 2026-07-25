import type {
  CreateExemplarData,
  CreateProductData,
  IExemplar,
  IProduct,
  IProductFilters,
  IProductsRepository,
  UpdateExemplarData,
  UpdateProductData,
} from '@panda-lavanda/domain'
import type { Paginated, UniqueId } from '@panda-lavanda/shared'

import {
  HttpRepository,
  type HttpRepositoryConfig,
} from './http.repository'

/**
 * HTTP-backed implementation of {@link IProductsRepository}.
 *
 * All persistence responsibility lives in the dedicated backend service
 * (`apps/api`, Fastify + Drizzle). This adapter is a thin client: it
 * serializes {@link IProductFilters} into query-string params, calls the
 * backend over `fetch` (via the shared {@link HttpRepository} base), and maps
 * the JSON response back to the domain {@link IProduct} shape (the backend
 * already returns camelCase entities, so the mapping is direct).
 *
 * `getById` and `update` treat a `404` as a legitimate "not found" result and
 * map it to `null` (to satisfy the port contract) — they call {@link request}
 * directly and inspect the status before parsing the body; all other methods
 * use the typed `get` / `post` / `patch` / `del` helpers.
 */
export class HttpProductsRepository
  extends HttpRepository
  implements IProductsRepository
{
  constructor(config: HttpRepositoryConfig) {
    super(config)
  }

  async create(data: CreateProductData): Promise<IProduct> {
    return this.post<IProduct>('/products', data)
  }

  async getMany(filters: IProductFilters): Promise<Paginated<IProduct>> {
    const query = buildListQuery(filters)
    return this.get<Paginated<IProduct>>(`/products${query}`)
  }

  async getById(id: UniqueId): Promise<IProduct | null> {
    // 404 → null: call `request` directly so we can inspect the status before
    // parsing. Any other failure still throws a typed AppError via the base.
    const response = await this.request(`/products/${id}`, { method: 'GET' })
    if (response.status === 404) return null
    return (await response.json()) as IProduct
  }

  async delete(id: UniqueId): Promise<void> {
    await this.del(`/products/${id}`)
  }

  async update(id: UniqueId, data: UpdateProductData): Promise<IProduct | null> {
    const response = await this.request(`/products/${id}`, {
      method: 'PATCH',
      body: data,
    })
    if (response.status === 404) return null
    return (await response.json()) as IProduct
  }

  async getExemplar(
    productId: UniqueId,
    exemplarId: UniqueId,
  ): Promise<IExemplar | null> {
    // 404 → null: see `getById`. Call `request` directly to inspect the status.
    const response = await this.request(
      `/products/${productId}/exemplars/${exemplarId}`,
      { method: 'GET' },
    )
    if (response.status === 404) return null
    return (await response.json()) as IExemplar
  }

  async createExemplar(
    productId: UniqueId,
    data: CreateExemplarData,
  ): Promise<IExemplar | null> {
    const response = await this.request(`/products/${productId}/exemplars`, {
      method: 'POST',
      body: data,
    })
    if (response.status === 404) return null
    return (await response.json()) as IExemplar
  }

  async updateExemplar(
    productId: UniqueId,
    exemplarId: UniqueId,
    data: UpdateExemplarData,
  ): Promise<IExemplar | null> {
    const response = await this.request(
      `/products/${productId}/exemplars/${exemplarId}`,
      { method: 'PATCH', body: data },
    )
    if (response.status === 404) return null
    return (await response.json()) as IExemplar
  }

  async deleteExemplar(
    productId: UniqueId,
    exemplarId: UniqueId,
  ): Promise<void> {
    await this.del(`/products/${productId}/exemplars/${exemplarId}`)
  }
}

/**
 * Builds the `?...` query string for `GET /products` from domain filters.
 *
 * Only present, defined filters are included. `ids` and `sort` arrays are
 * serialized as comma-separated values (the backend splits them back into
 * arrays). Returns an empty string when no filters apply.
 */
function buildListQuery(filters: IProductFilters): string {
  const params = new URLSearchParams()

  if (filters.page && filters.page > 0) {
    params.set('page', String(filters.page))
  }
  if (filters.pageSize && filters.pageSize > 0) {
    params.set('pageSize', String(filters.pageSize))
  }
  if (filters.search && filters.search.trim()) {
    params.set('search', filters.search.trim())
  }
  if (filters.categoryId) {
    params.set('categoryId', filters.categoryId)
  }
  if (filters.ids?.length) {
    params.set('ids', filters.ids.join(','))
  }
  if (filters.sort?.length) {
    params.set('sort', filters.sort.join(','))
  }

  const query = params.toString()
  return query ? `?${query}` : ''
}
