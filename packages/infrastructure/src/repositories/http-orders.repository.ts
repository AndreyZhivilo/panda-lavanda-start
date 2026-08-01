import type {
  CreateOrderData,
  IOrder,
  IOrdersRepository,
} from '@panda-lavanda/domain'
import type { UniqueId } from '@panda-lavanda/shared'

import {
  HttpRepository,
  type HttpRepositoryConfig,
} from './http.repository'

/**
 * HTTP-backed implementation of {@link IOrdersRepository}.
 *
 * All persistence responsibility lives in the dedicated backend service
 * (`apps/api`, Fastify + Drizzle). This adapter is a thin client: it serializes
 * {@link CreateOrderData} into the request body, calls the backend over `fetch`
 * (via the shared {@link HttpRepository} base), and maps the JSON response back
 * to the domain {@link IOrder} shape (the backend already returns camelCase
 * entities, so the mapping is direct).
 *
 * `getById` treats a `404` as a legitimate "not found" result and maps it to
 * `null` (to satisfy the port contract) — it calls {@link request} directly and
 * inspects the status before parsing the body; `create` uses the typed `post`
 * helper (a non-2xx throws a typed `AppError` via the base).
 *
 * Client-safe: uses only the platform `fetch`, no Node imports, no Drizzle — so
 * it is exported from both the main and the `./client` barrels.
 */
export class HttpOrdersRepository
  extends HttpRepository
  implements IOrdersRepository
{
  constructor(config: HttpRepositoryConfig) {
    super(config)
  }

  async create(data: CreateOrderData): Promise<IOrder> {
    return this.post<IOrder>('/orders', data)
  }

  async getById(id: UniqueId): Promise<IOrder | null> {
    // 404 → null: call `request` directly so we can inspect the status before
    // parsing. Any other failure still throws a typed AppError via the base.
    const response = await this.request(`/orders/${id}`, { method: 'GET' })
    if (response.status === 404) return null
    return (await response.json()) as IOrder
  }
}
