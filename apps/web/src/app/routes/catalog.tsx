import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { z } from 'zod'

import { getProducts } from '#/app/server-functions'
import { CatalogPage } from '#/presentation/pages/catalog-page'

/**
 * Search params for the catalog route.
 *
 * URL query params arrive as strings, so `page` uses `z.coerce.number()` to
 * parse first, then `.catch(1)` makes any invalid value (`?page=abc`,
 * `?page=-1`, `?page=0`) fall back to page 1 instead of erroring the route.
 *
 * `page` is **optional** — when absent from the URL, the catalog shows page 1
 * without forcing `?page=1` into the URL (see the middleware below, which
 * strips `page` when it equals the default).
 *
 * `q` is the free-text search query (filters products by name). It is optional
 * and stripped from the URL when empty (see middleware below).
 */
const DEFAULT_PAGE = 1

const catalogSearchSchema = z.object({
  page: z.coerce
    .number()
    .int()
    .positive()
    .catch(DEFAULT_PAGE)
    .optional()
    .default(DEFAULT_PAGE),
  q: z.string().optional(),
})

export const Route = createFileRoute('/catalog')({
  component: CatalogPage,
  validateSearch: catalogSearchSchema,
  // Strip defaults from the URL: `?page=1` → `/catalog`, and `?q=` (empty)
  // → `/catalog`. `loaderDeps` still receives the resolved values either way.
  search: {
    middlewares: [stripSearchParams({ page: DEFAULT_PAGE, q: '' })],
  },
  // Pick `page` and `q` out of the validated search; TanStack Router re-runs
  // the loader whenever either dep changes.
  loaderDeps: ({ search }) => ({ page: search.page, q: search.q }),
  loader: ({ deps }) =>
    getProducts({ data: { page: deps.page, search: deps.q } }),
})
