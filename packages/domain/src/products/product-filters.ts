import type { UniqueId } from '@panda-lavanda/shared'

import type { SortOrder } from './sort-order'

/** Filters for querying a list of products. */
export interface IProductFilters {
  /** Filter by category. */
  categoryId?: UniqueId
  /** Page number for pagination (1-based). */
  page?: number
  /** Page size (number of items per page). Defaults to the repository's value when omitted. */
  pageSize?: number
  /** Restrict to a specific set of product ids. */
  ids?: UniqueId[]
  /**
   * Sort keys to apply, in order of precedence (leftmost = primary).
   * Unknown keys are ignored by the repository.
   */
  sort?: SortOrder[]
}
