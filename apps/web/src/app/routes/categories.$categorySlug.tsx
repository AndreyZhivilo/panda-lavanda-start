import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { z } from 'zod'

import { getCategory, getProducts } from '#/app/server-functions'
import { CategoryPage } from '#/presentation/pages/category-page'

/**
 * Search params for the category route — mirrors the catalog route.
 *
 * URL query params arrive as strings, so `page` uses `z.coerce.number()` then
 * `.catch(1)` so any invalid value falls back to page 1 instead of erroring.
 * `page` is optional and stripped from the URL when it equals the default (see
 * the middleware below). `q` is the free-text search query (filters products by
 * name within this category); optional and stripped when empty.
 */
const DEFAULT_PAGE = 1

const categorySearchSchema = z.object({
  page: z.coerce
    .number()
    .int()
    .positive()
    .catch(DEFAULT_PAGE)
    .optional()
    .default(DEFAULT_PAGE),
  q: z.string().optional(),
})

export const Route = createFileRoute('/categories/$categorySlug')({
  component: CategoryPage,
  validateSearch: categorySearchSchema,
  // Strip defaults from the URL: `?page=1` → no param, `?q=` (empty) → no param.
  search: {
    middlewares: [stripSearchParams({ page: DEFAULT_PAGE, q: '' })],
  },
  // Pick `page` and `q` out of the validated search; TanStack Router re-runs
  // the loader whenever either dep changes.
  loaderDeps: ({ search }) => ({ page: search.page, q: search.q }),
  // Load the category AND its products on the server. The category must be
  // resolved first (the URL carries only its slug), because the products query
  // is filtered by the category *id*. When the category is missing we skip the
  // products call entirely and the page renders a "not found" state.
  loader: async ({ params, deps }) => {
    const category = await getCategory({ data: { slug: params.categorySlug } })

    if (category.ok && category.category) {
      const products = await getProducts({
        data: {
          page: deps.page,
          search: deps.q,
          categoryId: category.category.id,
        },
      })
      return { category, products }
    }

    return { category }
  },
  head: () => ({
    meta: [{ name: 'robots', content: 'noindex, nofollow' }],
  }),
})
