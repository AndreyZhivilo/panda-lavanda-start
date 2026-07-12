import type { UniqueId, ImageUrl } from '@panda-lavanda/shared'
import type {
  IProduct,
  IProductFilters,
} from '../products'

/** Partial product fields allowed in an update operation. */
export interface UpdateProductData {
  name?: string
  description?: string
  category?: UniqueId
  images?: ImageUrl[]
}

/**
 * Repository contract for products.
 *
 * The interface lives in the domain layer; concrete implementations
 * (e.g. Drizzle-backed) live in the infrastructure layer and are injected at
 * the composition root. This keeps the domain independent of any database.
 */
export interface IProductsRepository {
  /** Returns products matching the given filters. */
  getMany(filters: IProductFilters): Promise<IProduct[]>
  /** Returns a single product by id, or `null` if not found. */
  getById(id: UniqueId): Promise<IProduct | null>
  /** Permanently deletes a product by id (cascades to exemplars). */
  delete(id: UniqueId): Promise<void>
  /** Updates a product by id; returns the updated product or `null` if missing. */
  update(id: UniqueId, data: UpdateProductData): Promise<IProduct | null>
}
