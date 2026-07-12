import type { UniqueId } from '@panda-lavanda/shared'

/** Filters for querying a list of products. */
export interface IProductFilters {
  /** Filter by category. */
  categoryId?: UniqueId
  /** Page number for pagination (1-based). */
  page?: number
  /** Restrict to a specific set of product ids. */
  ids?: UniqueId[]
}
