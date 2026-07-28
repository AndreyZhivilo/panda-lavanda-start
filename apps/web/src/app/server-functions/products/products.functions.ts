import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { SortOrder } from '@panda-lavanda/domain'
import {
  getProductBySlugUseCase,
  getProductsUseCase,
} from '#/app/composition-root'

/**
 * Input shape callers pass into {@link getProducts}.
 *
 * `page` always arrives as a valid positive integer here: the catalog route's
 * `validateSearch` zod schema normalizes absent/invalid `?page=` values to 1.
 *
 * `ids`, when provided, restricts the result to the given product ids — used
 * by the client-rendered favorites page to load exactly the favorited
 * products. Omitted by the catalog route.
 *
 * `pageSize` overrides the repository default (20) when the caller knows the
 * expected count — e.g. the favorites page requests one page large enough to
 * hold every favorited id. The repository still caps it at 100.
 *
 * `search`, when provided, filters products by name (case-insensitive
 * substring match). The catalog route passes the `q` URL search param here.
 */
const getProductsInputSchema = z.object({
  page: z.number().int().positive().default(1),
  ids: z.array(z.string()).optional(),
  pageSize: z.number().int().positive().optional(),
  search: z.string().optional(),
})

/**
 * Loads one page of products on the server.
 *
 * The use case returns `Either<Error, Paginated<IProduct>>`; we fold it
 * here into a plain discriminated union because `Either` (a class with
 * methods) and `Error` don't survive TanStack Start's server→client
 * serialization. The route/loader/UI then work with this plain shape
 * (see `catalog-page.tsx` → `CatalogLoaderData`).
 *
 * As a `.functions.ts` file, this export is safe to import statically from
 * anywhere (routes, components) — TanStack Start's compiler replaces the
 * call with an RPC fetch in the client bundle; only the server keeps the
 * real handler body (which calls the backend over HTTP via
 * `HttpProductsRepository` — no database driver in the web app anymore).
 */
export const getProducts = createServerFn({ method: 'GET' })
  .validator(getProductsInputSchema)
  .handler(async ({ data }) => {
    // `OUT_OF_STOCK_LAST` is the catalog's default business rule, applied
    // server-side for every page; the user does not control it via URL.
    const result = await getProductsUseCase.execute({
      page: data.page,
      ids: data.ids,
      pageSize: data.pageSize,
      search: data.search,
      sort: [SortOrder.OUT_OF_STOCK_LAST],
    })

    if (result.isRight()) {
      const { items, total } = result.value
      return { ok: true as const, products: items, total, page: data.page }
    }

    const err = result.value
    return {
      ok: false as const,
      message: err.message,
    }
  })

/**
 * Input shape callers pass into {@link getProduct}: the product slug from the
 * route param (`/products/$productSlug`). The slug is the URL-friendly,
 * transliterated product name — it is the public identifier in product URLs.
 */
const getProductInputSchema = z.object({
  slug: z.string().min(1),
})

/**
 * Loads a single product (with its exemplars) on the server, by slug.
 *
 * Same Either→discriminated-union fold as {@link getProducts}: the use case
 * returns `Either<Error, IProduct | null>` (the repository maps a 404 to
 * `null`), so the success branch carries `product: IProduct | null`. The page
 * treats `null` as a "not found" case distinct from an error.
 */
export const getProduct = createServerFn({ method: 'GET' })
  .validator(getProductInputSchema)
  .handler(async ({ data }) => {
    const result = await getProductBySlugUseCase.execute(data.slug)

    if (result.isRight()) {
      return { ok: true as const, product: result.value }
    }

    const err = result.value
    return {
      ok: false as const,
      message: err.message,
    }
  })
